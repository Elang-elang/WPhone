package id.wphone.core.plugin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class WrPluginManagerTest {
    @Test
    fun inspectsValidWrpluginZipArchive() {
        val tempRoot = File.createTempFile("wphone_plugins_", "").apply { delete(); mkdirs() }
        val archive = File.createTempFile("sample_", ".wrplugin")
        try {
            ZipOutputStream(archive.outputStream()).use { zos ->
                zos.putNextEntry(ZipEntry("plugin.json"))
                zos.write(
                    """
                    {
                      "id": "id.wphone.testplugin",
                      "name": "Test Accent",
                      "version": "1.0.0",
                      "category": "frontend",
                      "permissions": ["ui.theme.accent"]
                    }
                    """.trimIndent().toByteArray()
                )
                zos.closeEntry()

                zos.putNextEntry(ZipEntry("main.js"))
                zos.write("export function onEnable(api) { api.setAccentColor('#059669'); }".toByteArray())
                zos.closeEntry()
            }

            val mgr = WrPluginManager(tempRoot)
            val validated = mgr.inspectArchive(archive)
            assertEquals("id.wphone.testplugin", validated.manifest.id)
            assertFalse(validated.requiresPrivilegedReview)
            assertTrue(validated.mainScriptContent.contains("setAccentColor"))
        } finally {
            archive.delete()
            tempRoot.deleteRecursively()
        }
    }
}
