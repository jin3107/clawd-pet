package com.rainy.clawdpet.wallpaper

import android.graphics.Canvas
import android.graphics.Paint
import kotlin.math.sin

/**
 * Hand-rolled equivalents of renderer/css/{states,keyframes}.css for the
 * six states PetState implements. Android's Canvas has no CSS keyframe
 * engine, so each animation is a small closed-form function of
 * `state.modeElapsedMs` (sine waves for ease-in-out loops, step functions
 * for the desktop's `steps(1)` snap-frame animations) rather than a literal
 * port of the keyframe percentages. Exact bezier timing isn't reproduced —
 * only the same shape/period — see the plan file for what's deferred.
 */
object PetRenderer {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    private fun stepFirstHalf(t: Float, periodMs: Float): Boolean = (t % periodMs) < periodMs / 2f

    /** 0..1..0 smooth loop, one full cycle per periodMs. */
    private fun sine01(t: Float, periodMs: Float): Float =
        (sin((t / periodMs) * 2f * Math.PI.toFloat() - (Math.PI / 2).toFloat()) + 1f) / 2f

    private fun rect(canvas: Canvas, x: Float, y: Float, w: Float, h: Float, color: Int, alpha: Int = 255) {
        paint.color = color
        paint.alpha = alpha
        canvas.drawRect(x, y, x + w, y + h, paint)
    }

    private fun rotated(canvas: Canvas, deg: Float, pivotX: Float, pivotY: Float, draw: () -> Unit) {
        canvas.save()
        canvas.rotate(deg, pivotX, pivotY)
        draw()
        canvas.restore()
    }

    /**
     * Draws the pet centered at local origin (0,0) — caller is expected to
     * have already translated/scaled/flipped the canvas to the pet's
     * current screen position, scale and facing.
     */
    fun draw(canvas: Canvas, state: PetState) {
        val t = state.modeElapsedMs

        // ── #bob-group: whole-body scale/rotate/translate around (40,40) ──
        var bobScaleY = 1f
        var bobRotateDeg = 0f
        var bobTranslateY = 0f
        when (state.mode) {
            Mode.IDLE -> bobScaleY = 1f + 0.03f * sine01(t, 2400f)
            Mode.WALK -> bobTranslateY = if (stepFirstHalf(t, 240f)) 0f else -2f
            Mode.JUMP -> {
                val p = (t % 450f) / 450f
                val lift = when {
                    p < 0.4f -> p / 0.4f
                    p < 0.6f -> 1f
                    else -> (1f - p) / 0.4f
                }.coerceIn(0f, 1f)
                bobTranslateY = -14f * lift
                bobScaleY = 0.94f + (1.05f - 0.94f) * lift
            }
            Mode.HELD -> bobRotateDeg = 4f * (sine01(t, 900f) * 2f - 1f)
            Mode.FALL -> {}
            Mode.PAT -> {
                bobScaleY = 1f + 0.06f * sine01(t, 600f)
                bobTranslateY = -1f * sine01(t, 600f)
            }
            Mode.THINK -> bobScaleY = 1f + 0.03f * sine01(t, 2400f)
        }

        // #bob-group transform-origin is (40,40): translate to the pivot,
        // apply translateY/rotate/scaleY, then translate back.
        canvas.save()
        canvas.translate(PetSprite.BOB_PIVOT_X, PetSprite.BOB_PIVOT_Y)
        canvas.translate(0f, bobTranslateY)
        canvas.rotate(bobRotateDeg)
        canvas.scale(1f, bobScaleY)
        canvas.translate(-PetSprite.BOB_PIVOT_X, -PetSprite.BOB_PIVOT_Y)

        // Hearts (pat only)
        if (state.mode == Mode.PAT) {
            drawHeart(canvas, PetSprite.heart1, t)
            drawHeart(canvas, PetSprite.heart2, t + 600f)
        }

        // Torso
        rect(canvas, PetSprite.torso.x, PetSprite.torso.y, PetSprite.torso.w, PetSprite.torso.h, PetSprite.torso.color)

        // Eyes
        val eyeScaleY = if (state.mode == Mode.HELD || state.mode == Mode.FALL) 1.25f else 1f
        val eyeSet = when {
            state.mode == Mode.PAT -> PetSprite.eyesHappy
            else -> PetSprite.eyesNormal
        }
        for (r in eyeSet) {
            if (eyeScaleY != 1f) {
                canvas.save()
                val cx = r.x + r.w / 2f
                val cy = r.y + r.h / 2f
                canvas.scale(1f, eyeScaleY, cx, cy)
                rect(canvas, r.x, r.y, r.w, r.h, r.color)
                canvas.restore()
            } else {
                rect(canvas, r.x, r.y, r.w, r.h, r.color)
            }
        }

        // Legs
        for (i in PetSprite.legX.indices) {
            val isLegA = i % 2 == 0
            var legOffsetY = 0f
            var legRotateDeg = 0f
            when (state.mode) {
                Mode.WALK -> legOffsetY = if (isLegA == stepFirstHalf(t, 240f)) -3f else 0f
                Mode.JUMP -> {
                    val p = (t % 450f) / 450f
                    val tuck = if (p in 0.4f..0.6f) 1f else 0f
                    legOffsetY = -4f * tuck
                }
                Mode.HELD -> {
                    val phase = if (isLegA) t else t + 300f
                    legOffsetY = 2f + sine01(phase, 600f) * 1f
                    legRotateDeg = 2f - sine01(phase, 600f) * 4f
                }
                Mode.FALL -> legOffsetY = -3f
                else -> {}
            }
            val lx = PetSprite.legX[i]
            rotated(canvas, legRotateDeg, lx, PetSprite.legY) {
                rect(canvas, lx, PetSprite.legY + legOffsetY, PetSprite.legW, PetSprite.legH, PetSprite.legColor)
            }
        }

        // Arms
        val armLDeg = armRotation(state, isLeft = true, t = t)
        val armRDeg = armRotation(state, isLeft = false, t = t)
        rotated(canvas, armLDeg, PetSprite.armLPivotX, PetSprite.armPivotY) {
            rect(canvas, PetSprite.armLX, PetSprite.armY, PetSprite.armW, PetSprite.armH, PetSprite.armColor)
        }
        rotated(canvas, armRDeg, PetSprite.armRPivotX, PetSprite.armPivotY) {
            rect(canvas, PetSprite.armRX, PetSprite.armY, PetSprite.armW, PetSprite.armH, PetSprite.armColor)
        }

        canvas.restore()
    }

    private fun armRotation(state: PetState, isLeft: Boolean, t: Float): Float {
        val sign = if (isLeft) -1f else 1f
        return when (state.mode) {
            Mode.WALK -> if (stepFirstHalf(t, 240f)) 0f else 16f * sign
            Mode.JUMP -> if (stepFirstHalf(t, 450f)) 0f else 16f * sign
            Mode.PAT -> if (stepFirstHalf(t, 600f)) 0f else 16f * sign
            Mode.HELD -> 6f * sign * (sine01(t, 900f) * 2f - 1f)
            Mode.IDLE -> 0f
            Mode.FALL -> 10f * sign * (sine01(t, 150f) * 2f - 1f)
            Mode.THINK -> 6f * sign * (sine01(t, 1800f) * 2f - 1f)
        }
    }

    private val bubbleTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.parseColor("#2B2B2B") }
    private val bubbleBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.parseColor("#F2F2F2") }
    private val bubbleBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#2B2B2B")
        style = Paint.Style.STROKE
    }

    /**
     * Draws the care-message speech bubble. Deliberately called with SCREEN
     * pixel coordinates (see ClawdWallpaperService.step()), not inside the
     * pet's own local-unit/scale transform — the pet itself is drawn quite
     * small (PET_SCREEN_FRACTION), and text scaled down along with it would
     * be unreadably tiny. This uses real dp-based sizes instead.
     */
    fun drawThinkBubble(canvas: Canvas, message: String, anchorX: Float, anchorY: Float, density: Float) {
        val textSize = 13f * density
        val paddingX = 10f * density
        val paddingY = 8f * density
        val lineHeight = textSize * 1.3f
        val maxWidth = 220f * density

        bubbleTextPaint.textSize = textSize
        bubbleBorderPaint.strokeWidth = 1.5f * density

        val lines = wrapToWidth(message, maxWidth)
        val textWidth = lines.maxOf { bubbleTextPaint.measureText(it) }
        val boxW = textWidth + paddingX * 2f
        val boxH = lines.size * lineHeight + paddingY * 2f
        val boxLeft = anchorX - boxW / 2f
        val boxTop = anchorY - boxH - 16f * density

        canvas.drawRect(boxLeft, boxTop, boxLeft + boxW, boxTop + boxH, bubbleBgPaint)
        canvas.drawRect(boxLeft, boxTop, boxLeft + boxW, boxTop + boxH, bubbleBorderPaint)

        val fm = bubbleTextPaint.fontMetrics
        lines.forEachIndexed { i, line ->
            val baseline = boxTop + paddingY + lineHeight * i - fm.ascent
            canvas.drawText(line, boxLeft + paddingX, baseline, bubbleTextPaint)
        }
    }

    private fun wrapToWidth(text: String, maxWidth: Float): List<String> {
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var current = StringBuilder()
        for (w in words) {
            val candidate = if (current.isEmpty()) w else "$current $w"
            if (current.isEmpty() || bubbleTextPaint.measureText(candidate) <= maxWidth) {
                current = StringBuilder(candidate)
            } else {
                lines.add(current.toString())
                current = StringBuilder(w)
            }
        }
        if (current.isNotEmpty()) lines.add(current.toString())
        return lines
    }

    private fun drawHeart(canvas: Canvas, blocks: List<SpriteRect>, t: Float) {
        val phase = (t % 1200f) / 1200f
        val y = 4f - 12f * phase
        val alpha = when {
            phase < 0.3f -> phase / 0.3f
            phase > 0.7f -> (1f - phase) / 0.3f
            else -> 1f
        }.coerceIn(0f, 1f)
        if (alpha <= 0f) return
        val alphaInt = (alpha * 255).toInt()
        for (b in blocks) rect(canvas, b.x, b.y + y, b.w, b.h, b.color, alphaInt)
    }
}
