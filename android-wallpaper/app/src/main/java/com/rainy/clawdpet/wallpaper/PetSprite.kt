package com.rainy.clawdpet.wallpaper

import android.graphics.Color

/**
 * Every coordinate below is copied 1:1 from the `<rect>` list in the desktop
 * app's renderer/index.html (SVG viewBox "-52 -54 184 120"). Local sprite
 * units, NOT screen pixels — PetEngine scales+translates this whole space
 * onto the wallpaper's real canvas each frame.
 *
 * v1 only ports the base body + eyes + hearts (idle/walk/jump/held/fall/pat).
 * Props tied to skipped tricks (laptop, headphones, dj-table, ball, cup,
 * parachute, think-bubble, surfboard) are intentionally left out — see the
 * plan file for the full list of what's deferred.
 */
data class SpriteRect(val x: Float, val y: Float, val w: Float, val h: Float, val color: Int)

object PetSprite {
    private fun c(hex: String) = Color.parseColor(hex)

    val torso = SpriteRect(10f, 0f, 60f, 40f, c("#D9835F"))

    val eyesNormal = listOf(
        SpriteRect(16f, 6f, 8f, 8f, c("#242320")),
        SpriteRect(56f, 6f, 8f, 8f, c("#242320")),
    )
    val eyesHappy = listOf(
        SpriteRect(15f, 10f, 4f, 4f, c("#242320")),
        SpriteRect(19f, 6f, 4f, 4f, c("#242320")),
        SpriteRect(23f, 10f, 4f, 4f, c("#242320")),
        SpriteRect(55f, 10f, 4f, 4f, c("#242320")),
        SpriteRect(59f, 6f, 4f, 4f, c("#242320")),
        SpriteRect(63f, 10f, 4f, 4f, c("#242320")),
    )
    val eyesScared = listOf(
        SpriteRect(16f, 6f, 4f, 4f, c("#242320")),
        SpriteRect(16f, 14f, 4f, 4f, c("#242320")),
        SpriteRect(22f, 10f, 4f, 4f, c("#242320")),
        SpriteRect(60f, 6f, 4f, 4f, c("#242320")),
        SpriteRect(60f, 14f, 4f, 4f, c("#242320")),
        SpriteRect(54f, 10f, 4f, 4f, c("#242320")),
    )

    val legColor = c("#C46F4D")
    // x positions match renderer/index.html's .leg-a/.leg-b rects — index
    // 0,2 are "leg-a", 1,3 are "leg-b" (alternate during walk/dangle).
    val legX = floatArrayOf(10f, 27.4f, 44.8f, 62.2f)
    const val legY = 40f
    const val legW = 7.8f
    const val legH = 15f

    val armColor = c("#D9835F")
    const val armY = 14f
    const val armW = 17f
    const val armH = 12f
    const val armLX = -7f
    const val armRX = 70f
    // Pivot points used by base.css's .arm-l / .arm-r transform-origin —
    // rotation for arm-flap/arm-sway pivots around these, not the rect corner.
    const val armLPivotX = 10f
    const val armRPivotX = 70f
    const val armPivotY = 20f

    val heartColor = c("#E06C9F")
    val heart1 = listOf(
        SpriteRect(14f, -14f, 3f, 3f, heartColor),
        SpriteRect(20f, -14f, 3f, 3f, heartColor),
        SpriteRect(14f, -11f, 9f, 3f, heartColor),
        SpriteRect(17f, -8f, 3f, 3f, heartColor),
    )
    val heart2 = listOf(
        SpriteRect(52f, -12f, 3f, 3f, heartColor),
        SpriteRect(58f, -12f, 3f, 3f, heartColor),
        SpriteRect(52f, -9f, 9f, 3f, heartColor),
        SpriteRect(55f, -6f, 3f, 3f, heartColor),
    )

    // Whole-sprite local bounding box, matches desktop's PET_W/PET_H.
    const val WIDTH = 100f
    const val HEIGHT = 65f
    // #bob-group transform-origin from base.css — breathe/hop/sway scale
    // and rotate around this point, not the canvas origin.
    const val BOB_PIVOT_X = 40f
    const val BOB_PIVOT_Y = 40f
}
