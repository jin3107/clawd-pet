package com.rainy.clawdpet.wallpaper

import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.WindowInsets

// Kotlin doesn't allow companion objects inside `inner class`, so these live
// at file scope instead of inside PetEngine below.
private const val FRAME_MS = 30L
private const val PET_SCREEN_FRACTION = 0.18f
// Tune this if the pet still sits behind/near the launcher's search bar or
// dock — raise it for launchers with a taller bottom bar.
private const val EXTRA_BOTTOM_MARGIN_DP = 110f
// Not `const` — Color.parseColor() is a function call, not a compile-time
// constant, so Kotlin won't allow `const` here.
private val BACKDROP_COLOR = Color.parseColor("#EAE6DF")

// Rough head-zone box in local units — matches renderer/index.html's
// #head-zone rect (x=10,y=0,w=60,h=20) relative to the pet's origin.
private val HEAD_ZONE_X = 10f..70f
private val HEAD_ZONE_Y = 0f..20f

class ClawdWallpaperService : WallpaperService() {
    override fun onCreateEngine(): Engine = PetEngine()

    /**
     * `Engine` is a non-static inner class of WallpaperService in the
     * Android framework, so in Kotlin the class that extends it must itself
     * be an `inner class` nested inside a WallpaperService subclass (a
     * standalone class taking WallpaperService as a constructor parameter
     * does not work — Kotlin can't bind it to the right outer instance).
     *
     * Renders + drives PetState on a Handler loop (~30ms, matching desktop
     * main.js's FAST_MS) while the surface is visible, and stops the loop
     * the moment another app/launcher covers it (onVisibilityChanged) so it
     * doesn't burn battery in the background — this is also exactly the
     * "app khác che được nó" behavior that was the point of using a live
     * wallpaper instead of an always-on-top overlay.
     */
    inner class PetEngine : Engine() {

        private val state = PetState()
        private val handler = Handler(Looper.getMainLooper())
        private var visible = false
        private var lastFrameAt = 0L

        /** Local sprite units (PetSprite.WIDTH/HEIGHT) per real screen pixel. */
        private var scale = 1f

        private var surfaceW = 0
        private var surfaceH = 0
        private var backdrop: Bitmap? = null

        // System bar insets (status bar, nav bar / gesture handle). Without
        // subtracting these, the pet's walkable area is the *raw* surface
        // size — which on landscape with 3-button/gesture nav can put the
        // ground line behind the opaque nav bar, so climbing looks stuck
        // "under the buttons". Both onSurfaceChanged and onApplyWindowInsets
        // can fire independently on rotation, so both funnel into
        // updateBounds() below.
        private var insetLeft = 0
        private var insetTop = 0
        private var insetRight = 0
        private var insetBottom = 0

        private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            loadBackdrop()
            scheduleCareMessage()
        }

        private val drawRunnable = object : Runnable {
            override fun run() {
                step()
                if (visible) handler.postDelayed(this, FRAME_MS)
            }
        }

        private val careRunnable = Runnable {
            val greetings = PetPrefs.getGreetings(this@ClawdWallpaperService)
            if (greetings.isNotEmpty()) {
                val msg = greetings.random()
                val durationMs = (msg.length * 90).coerceIn(3000, 8000).toFloat()
                state.showMessage(msg, durationMs)
            }
            scheduleCareMessage()
        }

        private fun scheduleCareMessage() {
            handler.removeCallbacks(careRunnable)
            val minMin = PetPrefs.getIntervalMinMin(this@ClawdWallpaperService).coerceAtLeast(1)
            val maxMin = PetPrefs.getIntervalMaxMin(this@ClawdWallpaperService).coerceAtLeast(minMin)
            val minMs = minMin * 60_000L
            val maxMs = maxMin * 60_000L
            val delay = minMs + (Math.random() * (maxMs - minMs)).toLong()
            handler.postDelayed(careRunnable, delay)
        }

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            // Without this, most launchers never forward touch events to the
            // wallpaper at all. Even with it, some launchers only forward
            // taps, not full drag sequences — that's a launcher limitation,
            // not something this engine can work around.
            setTouchEventsEnabled(true)
            PetPrefs.registerListener(this@ClawdWallpaperService, prefsListener)
            scheduleCareMessage()
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            lastFrameAt = System.currentTimeMillis()
        }

        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            super.onSurfaceChanged(holder, format, width, height)
            surfaceW = width
            surfaceH = height
            updateBounds()
            loadBackdrop()
        }

        @Suppress("DEPRECATION") // getSystemWindowInset* still works fine down to minSdk 26;
        // the newer Type-based WindowInsets API only exists from API 30.
        override fun onApplyWindowInsets(insets: WindowInsets?) {
            super.onApplyWindowInsets(insets)
            insetLeft = insets?.systemWindowInsetLeft ?: 0
            insetTop = insets?.systemWindowInsetTop ?: 0
            insetRight = insets?.systemWindowInsetRight ?: 0
            insetBottom = insets?.systemWindowInsetBottom ?: 0
            updateBounds()
        }

        private fun updateBounds() {
            if (surfaceW <= 0 || surfaceH <= 0) return
            // Most launchers dock a search bar / dock row near the bottom of
            // the home screen. There's no public API for a wallpaper to ask
            // "where is that" — it's the launcher's own UI, drawn above us —
            // so we just keep the pet's ground line comfortably above where
            // that dock usually sits, via a fixed safety margin.
            val extraBottomPx = (EXTRA_BOTTOM_MARGIN_DP * resources.displayMetrics.density).toInt()
            val usableW = (surfaceW - insetLeft - insetRight).coerceAtLeast(1)
            val usableH = (surfaceH - insetTop - insetBottom - extraBottomPx).coerceAtLeast(1)
            // Fit PET_SCREEN_FRACTION of the *usable* width to the pet —
            // tune that constant to make the pet bigger/smaller.
            scale = (usableW * PET_SCREEN_FRACTION) / PetSprite.WIDTH
            state.onSurfaceSize(usableW / scale, usableH / scale)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            this.visible = visible
            if (visible) {
                lastFrameAt = System.currentTimeMillis()
                handler.post(drawRunnable)
            } else {
                handler.removeCallbacks(drawRunnable)
            }
        }

        override fun onDestroy() {
            super.onDestroy()
            handler.removeCallbacks(drawRunnable)
            handler.removeCallbacks(careRunnable)
            PetPrefs.unregisterListener(this@ClawdWallpaperService, prefsListener)
            backdrop?.recycle()
            backdrop = null
        }

        override fun onTouchEvent(event: MotionEvent) {
            val lx = (event.x - insetLeft) / scale
            val ly = (event.y - insetTop) / scale
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    val petLocalX = lx - state.currentX
                    val petLocalY = ly - state.currentY
                    val overPet = petLocalX in 0f..PetSprite.WIDTH && petLocalY in 0f..PetSprite.HEIGHT
                    if (!overPet) return
                    val onHead = petLocalX in HEAD_ZONE_X && petLocalY in HEAD_ZONE_Y
                    if (onHead) {
                        state.setPatting(true)
                    } else {
                        state.startDrag(lx - PetSprite.WIDTH / 2f, ly - PetSprite.HEIGHT / 2f)
                    }
                }
                MotionEvent.ACTION_MOVE -> state.moveDrag(lx - PetSprite.WIDTH / 2f, ly - PetSprite.HEIGHT / 2f)
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    state.endDrag()
                    state.setPatting(false)
                }
            }
        }

        /**
         * Loads+downscales the user-picked photo (see MainActivity /
         * PetPrefs) to exactly the surface size, so nothing visually
         * changes for the user besides the pet now walking across it. No
         * photo picked → falls back to a flat neutral color in step().
         */
        private fun loadBackdrop() {
            backdrop?.recycle()
            backdrop = null
            if (surfaceW <= 0 || surfaceH <= 0) return
            val uriString = PetPrefs.getBackgroundUri(this@ClawdWallpaperService) ?: return
            try {
                val uri = Uri.parse(uriString)
                val resolver = contentResolver
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
                val sampleSize = calculateSampleSize(bounds.outWidth, bounds.outHeight, surfaceW, surfaceH)
                val opts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
                val raw = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
                    ?: return
                backdrop = cropToFill(raw, surfaceW, surfaceH)
                if (backdrop !== raw) raw.recycle()
            } catch (e: Exception) {
                // Picked file got deleted/moved/permission revoked — just
                // fall back to the flat color rather than crashing the
                // wallpaper (which would knock the user back to no wallpaper
                // at all).
                backdrop = null
            }
        }

        private fun calculateSampleSize(srcW: Int, srcH: Int, targetW: Int, targetH: Int): Int {
            var sample = 1
            while (srcW / (sample * 2) >= targetW && srcH / (sample * 2) >= targetH) sample *= 2
            return sample
        }

        private fun cropToFill(src: Bitmap, targetW: Int, targetH: Int): Bitmap {
            val srcRatio = src.width.toFloat() / src.height.toFloat()
            val targetRatio = targetW.toFloat() / targetH.toFloat()
            val scaleFactor = if (srcRatio > targetRatio) {
                targetH.toFloat() / src.height.toFloat()
            } else {
                targetW.toFloat() / src.width.toFloat()
            }
            val scaledW = (src.width * scaleFactor).toInt().coerceAtLeast(1)
            val scaledH = (src.height * scaleFactor).toInt().coerceAtLeast(1)
            val scaled = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(scaled)
            val matrix = Matrix().apply {
                postScale(scaleFactor, scaleFactor)
                postTranslate((targetW - scaledW) / 2f, (targetH - scaledH) / 2f)
            }
            canvas.drawBitmap(src, matrix, null)
            return scaled
        }

        private fun step() {
            val now = System.currentTimeMillis()
            val delta = (now - lastFrameAt).coerceIn(1, 200).toFloat()
            lastFrameAt = now
            state.tick(delta)

            val holder = surfaceHolder
            var canvas: Canvas? = null
            try {
                canvas = holder.lockCanvas()
                canvas ?: return
                val bg = backdrop
                if (bg != null) canvas.drawBitmap(bg, 0f, 0f, null) else canvas.drawColor(BACKDROP_COLOR)

                canvas.save()
                canvas.translate(insetLeft.toFloat(), insetTop.toFloat())
                canvas.scale(scale, scale)
                canvas.translate(state.currentX, state.currentY)
                if (state.facing < 0f) {
                    canvas.scale(-1f, 1f, PetSprite.WIDTH / 2f, 0f)
                }
                PetRenderer.draw(canvas, state)
                canvas.restore()

                val msg = state.currentMessage
                if (state.mode == Mode.THINK && msg != null) {
                    val anchorX = insetLeft + scale * (state.currentX + PetSprite.WIDTH / 2f)
                    val anchorY = insetTop + scale * state.currentY
                    PetRenderer.drawThinkBubble(canvas, msg, anchorX, anchorY, resources.displayMetrics.density)
                }
            } finally {
                if (canvas != null) holder.unlockCanvasAndPost(canvas)
            }
        }
    }
}
