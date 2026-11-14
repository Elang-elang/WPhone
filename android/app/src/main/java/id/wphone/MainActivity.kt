package id.wphone

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import id.wphone.core.config.DeviceCapabilities
import id.wphone.core.config.WindowsAppConfig

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as WPhoneApplication
        val caps = app.deviceAnalyzer.analyze()

        setContent {
            val isDark = androidx.compose.foundation.isSystemInDarkTheme()
            val scheme = if (isDark) {
                darkColorScheme(primary = Color(0xFF38BDF8), background = Color(0xFF0B1120))
            } else {
                lightColorScheme(primary = Color(0xFF0078D4), background = Color(0xFFF8FAFC))
            }

            MaterialTheme(colorScheme = scheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    WPhoneShell(caps = caps)
                }
            }
        }
    }
}

@Composable
private fun WPhoneShell(caps: DeviceCapabilities) {
    var initialized by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableIntStateOf(0) }

    if (!initialized) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(stringResource(R.string.wizard_title), style = MaterialTheme.typography.headlineSmall)
            Text(stringResource(R.string.wizard_subtitle), style = MaterialTheme.typography.bodyMedium)
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("SoC: ${caps.socModel}")
                    Text("ABI: ${caps.primaryAbi} · RAM: ${caps.totalRamMb} MB")
                    Text("Recommended: ${caps.recommendedProfile.name} (${caps.recommendedGraphics.name})")
                    caps.compatibilityWarnings.forEach { warn ->
                        Text(warn, color = Color(0xFFD97706), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            Spacer(modifier = Modifier.weight(1f))
            Button(
                onClick = { initialized = true },
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text("Initialize Wine WoW64 + Box64")
            }
        }
    } else {
        Scaffold(
            bottomBar = {
                NavigationBar {
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        icon = { Text("Apps") },
                        label = { Text(stringResource(R.string.library_title)) }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        icon = { Text("Admin") },
                        label = { Text(stringResource(R.string.admin_title)) }
                    )
                }
            }
        ) { padding ->
            Box(modifier = Modifier.padding(padding).padding(16.dp)) {
                if (selectedTab == 0) {
                    val sampleApps = remember {
                        listOf(
                            WindowsAppConfig(
                                id = "notepadpp",
                                name = "Notepad++",
                                category = "Utilities",
                                executablePath = "C:\\Program Files\\Notepad++\\notepad++.exe",
                                workingDirectory = "C:\\Program Files\\Notepad++",
                                prefixId = "pfx-notepadpp"
                            )
                        )
                    }
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(sampleApps) { item ->
                            OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Text(item.name, style = MaterialTheme.typography.titleMedium)
                                    Text("${item.arch} · ${item.prefixId}", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(stringResource(R.string.admin_title), style = MaterialTheme.typography.titleLarge)
                        Text(stringResource(R.string.warning_prefix_not_sandbox), style = MaterialTheme.typography.bodySmall)
                        Text("Native Bridge: ${WPhoneNativeBridge.getNativeAbiInfo()}")
                    }
                }
            }
        }
    }
}
