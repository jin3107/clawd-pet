package com.rainy.clawdpet

import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rainy.clawdpet.wallpaper.ClawdWallpaperService
import com.rainy.clawdpet.wallpaper.PetPrefs

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var screen by remember { mutableStateOf("home") }
                    if (screen == "home") {
                        HomeScreen(
                            onSetWallpaper = ::openSetWallpaper,
                            onOpenSettings = { screen = "settings" },
                        )
                    } else {
                        SettingsScreen(onDone = { screen = "home" })
                    }
                }
            }
        }
    }

    private fun openSetWallpaper() {
        val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
            putExtra(
                WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                ComponentName(this@MainActivity, ClawdWallpaperService::class.java)
            )
        }
        startActivity(intent)
    }
}

@Composable
private fun HomeScreen(onSetWallpaper: () -> Unit, onOpenSettings: () -> Unit) {
    val context = LocalContext.current
    var backgroundUri by remember { mutableStateOf(PetPrefs.getBackgroundUri(context)) }

    // ACTION_OPEN_DOCUMENT (not GetContent/PickVisualMedia) so we can take a
    // *persistable* read permission — the wallpaper engine keeps running long
    // after this Activity is gone, so a temporary grant wouldn't survive.
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        PetPrefs.setBackgroundUri(context, uri.toString())
        backgroundUri = uri.toString()
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Clawd Pet",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        Text(
            text = stringResource(R.string.home_hint),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        Text(
            text = stringResource(R.string.background_hint),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )

        OutlinedButton(onClick = { pickImage.launch(arrayOf("image/*")) }) {
            Text(
                text = if (backgroundUri == null) {
                    stringResource(R.string.pick_background_button)
                } else {
                    stringResource(R.string.change_background_button)
                }
            )
        }
        if (backgroundUri != null) {
            OutlinedButton(onClick = {
                PetPrefs.setBackgroundUri(context, null)
                backgroundUri = null
            }) {
                Text(text = stringResource(R.string.clear_background_button))
            }
        }

        OutlinedButton(onClick = onOpenSettings) {
            Text(text = stringResource(R.string.settings_button))
        }

        Button(onClick = onSetWallpaper) {
            Text(text = stringResource(R.string.set_wallpaper_button))
        }
    }
}

@Composable
private fun SettingsScreen(onDone: () -> Unit) {
    val context = LocalContext.current
    var petName by remember { mutableStateOf(PetPrefs.getPetName(context)) }
    val enabledSet = remember {
        mutableStateOf(PetPrefs.getEnabledGreetings(context).toMutableSet())
    }
    var customText by remember {
        mutableStateOf(PetPrefs.getCustomGreetings(context).joinToString("\n"))
    }
    var intervalMin by remember { mutableStateOf(PetPrefs.getIntervalMinMin(context).toString()) }
    var intervalMax by remember { mutableStateOf(PetPrefs.getIntervalMaxMin(context).toString()) }
    var error by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                text = stringResource(R.string.settings_title),
                style = MaterialTheme.typography.headlineSmall,
            )
        }
        item {
            Text(text = stringResource(R.string.pet_name_label), style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = petName,
                onValueChange = { petName = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
        }
        item {
            Text(text = stringResource(R.string.default_greetings_label), style = MaterialTheme.typography.labelLarge)
        }
        items(PetPrefs.DEFAULT_GREETINGS) { greeting ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Switch(
                    checked = enabledSet.value.contains(greeting),
                    onCheckedChange = { checked ->
                        val next = enabledSet.value.toMutableSet()
                        if (checked) next.add(greeting) else next.remove(greeting)
                        enabledSet.value = next
                    },
                )
                Text(text = greeting, style = MaterialTheme.typography.bodyMedium)
            }
        }
        item {
            Text(text = stringResource(R.string.custom_greetings_label), style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = customText,
                onValueChange = { customText = it },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
            )
        }
        item {
            Text(text = stringResource(R.string.interval_label), style = MaterialTheme.typography.labelLarge)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = intervalMin,
                    onValueChange = { intervalMin = it },
                    modifier = Modifier.width(90.dp),
                    singleLine = true,
                )
                Text(text = stringResource(R.string.interval_to))
                OutlinedTextField(
                    value = intervalMax,
                    onValueChange = { intervalMax = it },
                    modifier = Modifier.width(90.dp),
                    singleLine = true,
                )
            }
        }
        error?.let { msg ->
            item { Text(text = msg, color = MaterialTheme.colorScheme.error) }
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                OutlinedButton(onClick = onDone) { Text(text = stringResource(R.string.cancel_button)) }
                Button(
                    modifier = Modifier.padding(start = 10.dp),
                    onClick = {
                        val name = petName.trim().ifBlank { PetPrefs.DEFAULT_PET_NAME }
                        val enabled = PetPrefs.DEFAULT_GREETINGS.filter { enabledSet.value.contains(it) }
                        val custom = customText.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
                        val min = intervalMin.toIntOrNull() ?: -1
                        val max = intervalMax.toIntOrNull() ?: -1

                        error = when {
                            min < 1 || max < 1 -> "Thời gian phải là số nguyên dương."
                            max < min -> "Giá trị \"đến\" phải lớn hơn hoặc bằng giá trị đầu."
                            enabled.isEmpty() && custom.isEmpty() -> "Chọn ít nhất một câu mặc định hoặc tự nhập một câu."
                            else -> null
                        }
                        if (error != null) return@Button

                        PetPrefs.saveSettings(context, name, enabled, custom, min, max)
                        onDone()
                    },
                ) { Text(text = stringResource(R.string.save_button)) }
            }
        }
    }
}
