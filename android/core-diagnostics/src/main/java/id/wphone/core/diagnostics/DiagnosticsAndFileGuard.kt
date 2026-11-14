package id.wphone.core.diagnostics

import java.io.File

class ProtectedFileManager(private val wphoneRoot: File) {

    private val protectedRelativePrefixes = listOf("runtime", "config")

    fun isProtected(target: File): Boolean {
        val rel = target.canonicalFile.relativeToOrNull(wphoneRoot.canonicalFile)?.path ?: return true
        if (rel.isEmpty() || rel == "prefixes") return true
        return protectedRelativePrefixes.any { rel == it || rel.startsWith("$it/") }
    }

    fun deleteSafely(target: File): Result<Unit> {
        if (isProtected(target)) {
            return Result.failure(
                SecurityException("Deletion blocked: ${target.name} is protected by WPhone.")
            )
        }
        return if (target.deleteRecursively()) Result.success(Unit)
        else Result.failure(IllegalStateException("Failed to delete ${target.name}"))
    }
}
