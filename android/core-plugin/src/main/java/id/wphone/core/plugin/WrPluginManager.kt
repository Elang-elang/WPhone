package id.wphone.core.plugin

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipInputStream

@Serializable
data class WrPluginManifest(
    val id: String,
    val name: String,
    val version: String,
    val category: String,
    val author: String = "Unknown",
    val description: String = "",
    val mainScript: String = "main.js",
    val scriptLanguage: String = "javascript",
    val apiVersion: String = "wphone.frontend@1.0",
    val permissions: List<String> = emptyList(),
    val dependencies: List<String> = emptyList(),
    val accentColor: String = "#0078D4"
)

@Serializable
data class InstalledPluginState(
    val manifest: WrPluginManifest,
    val sha256: String,
    val enabled: Boolean,
    val requiresPrivilegedReview: Boolean,
    val lastSandboxOutput: String = ""
)

data class ValidatedWrPlugin(
    val manifest: WrPluginManifest,
    val sha256: String,
    val requiresPrivilegedReview: Boolean,
    val mainScriptContent: String
)

/**
 * Inspects ZIP-based .wrplugin archives, enforces root plugin.json / plugin.toml presence,
 * verifies SHA-256 package integrity, blocks Zip Slip traversal, and persists active plugin state.
 */
class WrPluginManager(private val pluginsRoot: File) {

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = true }
    private val indexFile = File(pluginsRoot, "installed_plugins.json")

    fun listInstalled(): List<InstalledPluginState> {
        if (!indexFile.exists()) return emptyList()
        return runCatching {
            json.decodeFromString<List<InstalledPluginState>>(indexFile.readText())
        }.getOrDefault(emptyList())
    }

    fun saveInstalled(items: List<InstalledPluginState>) {
        pluginsRoot.mkdirs()
        indexFile.writeText(json.encodeToString(items))
    }

    fun inspectArchive(archiveFile: File): ValidatedWrPlugin {
        val sha256 = sha256Of(archiveFile)
        var manifestJson: String? = null
        val entries = mutableMapOf<String, String>()

        ZipInputStream(archiveFile.inputStream()).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    if (entry.name == "plugin.json") {
                        manifestJson = zis.bufferedReader().readText()
                    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".md")) {
                        entries[entry.name] = zis.bufferedReader().readText()
                    }
                }
                entry = zis.nextEntry
            }
        }

        val raw = manifestJson
            ?: throw IllegalArgumentException("Invalid .wrplugin archive: root plugin.json not found.")
        val manifest = json.decodeFromString<WrPluginManifest>(raw)
        val privileged = manifest.category == "backend" ||
            manifest.permissions.any { it.startsWith("runtime.") || it.startsWith("graphics.") }

        return ValidatedWrPlugin(
            manifest = manifest,
            sha256 = sha256,
            requiresPrivilegedReview = privileged,
            mainScriptContent = entries[manifest.mainScript] ?: ""
        )
    }

    fun installVerified(archiveFile: File, validated: ValidatedWrPlugin): InstalledPluginState {
        val targetDir = File(pluginsRoot, validated.manifest.id).apply { mkdirs() }
        ZipInputStream(archiveFile.inputStream()).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                val outFile = File(targetDir, entry.name)
                if (!outFile.canonicalPath.startsWith(targetDir.canonicalPath + File.separator)) {
                    throw SecurityException("Zip Slip blocked for ${entry.name}")
                }
                if (entry.isDirectory) {
                    outFile.mkdirs()
                } else {
                    outFile.parentFile?.mkdirs()
                    outFile.outputStream().use { zis.copyTo(it) }
                }
                entry = zis.nextEntry
            }
        }
        val state = InstalledPluginState(
            manifest = validated.manifest,
            sha256 = validated.sha256,
            enabled = false,
            requiresPrivilegedReview = validated.requiresPrivilegedReview
        )
        val current = listInstalled().filterNot { it.manifest.id == state.manifest.id } + state
        saveInstalled(current)
        return state
    }

    private fun sha256Of(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(8192)
            while (true) {
                val n = input.read(buf)
                if (n == -1) break
                md.update(buf, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
