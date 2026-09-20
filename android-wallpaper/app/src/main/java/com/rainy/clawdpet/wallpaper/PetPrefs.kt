package com.rainy.clawdpet.wallpaper

import android.content.Context
import android.content.SharedPreferences

/**
 * Shared between MainActivity (Settings screen + backdrop picker) and
 * PetEngine (reads everything every frame/schedule tick). Mirrors the
 * desktop app's config.js / mobile's storage/config.js — same default
 * greetings, same field names in spirit — just backed by SharedPreferences
 * instead of a JSON file or AsyncStorage.
 */
object PetPrefs {
    private const val PREFS_NAME = "clawd_pet_prefs"
    private const val KEY_BACKGROUND_URI = "background_uri"
    private const val KEY_PET_NAME = "pet_name"
    private const val KEY_ENABLED_GREETINGS = "enabled_greetings" // newline-joined
    private const val KEY_CUSTOM_GREETINGS = "custom_greetings"   // newline-joined
    private const val KEY_INTERVAL_MIN = "interval_min_min"
    private const val KEY_INTERVAL_MAX = "interval_max_min"

    const val DEFAULT_PET_NAME = "Clawd Pet"
    const val DEFAULT_INTERVAL_MIN = 60
    const val DEFAULT_INTERVAL_MAX = 75

    val DEFAULT_GREETINGS = listOf(
        "Uống nước chưa đó?",
        "Ngồi lâu rồi, đứng dậy vươn vai xíu đi.",
        "Nay ổn không?",
        "Nhớ ăn uống đúng giờ nha.",
        "Mỏi mắt chưa? Nhìn ra xa xíu đi.",
        "Làm việc mệt thì nghỉ chút đã, không vội đâu.",
        "Vẫn đang ở đây với bạn nè.",
    )

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getBackgroundUri(context: Context): String? = prefs(context).getString(KEY_BACKGROUND_URI, null)

    fun setBackgroundUri(context: Context, uri: String?) {
        prefs(context).edit().putString(KEY_BACKGROUND_URI, uri).apply()
    }

    fun getPetName(context: Context): String =
        prefs(context).getString(KEY_PET_NAME, DEFAULT_PET_NAME)?.takeIf { it.isNotBlank() } ?: DEFAULT_PET_NAME

    fun getEnabledGreetings(context: Context): List<String> {
        val raw = prefs(context).getString(KEY_ENABLED_GREETINGS, null) ?: return DEFAULT_GREETINGS
        return raw.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
    }

    fun getCustomGreetings(context: Context): List<String> {
        val raw = prefs(context).getString(KEY_CUSTOM_GREETINGS, "") ?: ""
        return raw.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
    }

    /** enabledGreetings + customGreetings, falling back to the defaults if both are empty. */
    fun getGreetings(context: Context): List<String> {
        val combined = getEnabledGreetings(context) + getCustomGreetings(context)
        return combined.ifEmpty { DEFAULT_GREETINGS }
    }

    fun getIntervalMinMin(context: Context): Int = prefs(context).getInt(KEY_INTERVAL_MIN, DEFAULT_INTERVAL_MIN)
    fun getIntervalMaxMin(context: Context): Int = prefs(context).getInt(KEY_INTERVAL_MAX, DEFAULT_INTERVAL_MAX)

    fun saveSettings(
        context: Context,
        petName: String,
        enabledGreetings: List<String>,
        customGreetings: List<String>,
        intervalMinMin: Int,
        intervalMaxMin: Int,
    ) {
        prefs(context).edit()
            .putString(KEY_PET_NAME, petName)
            .putString(KEY_ENABLED_GREETINGS, enabledGreetings.joinToString("\n"))
            .putString(KEY_CUSTOM_GREETINGS, customGreetings.joinToString("\n"))
            .putInt(KEY_INTERVAL_MIN, intervalMinMin)
            .putInt(KEY_INTERVAL_MAX, intervalMaxMin)
            .apply()
    }

    fun registerListener(context: Context, listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        prefs(context).registerOnSharedPreferenceChangeListener(listener)
    }

    fun unregisterListener(context: Context, listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        prefs(context).unregisterOnSharedPreferenceChangeListener(listener)
    }
}
