package me.ayartuerk.crmadmin.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ManagedCurrentAdmin(
    val username: String = "",
    val role: String = "",
    @SerialName("is_superadmin")
    val isSuperadmin: Boolean = false
)

@Serializable
data class ManagedAdmin(
    val id: Long? = null,
    val username: String = "",
    val email: String = "",
    val role: String = "admin",
    @SerialName("is_active")
    val isActive: Boolean = false,
    val source: String = "",
    @SerialName("created_at")
    val createdAt: String = "",
    @SerialName("last_login_at")
    val lastLoginAt: String = "",
    val protected: Boolean = false
)

@Serializable
data class AdminAuditLog(
    val id: Long = 0,
    val username: String = "",
    val role: String = "",
    @SerialName("action_type")
    val actionType: String = "",
    @SerialName("action_detail")
    val actionDetail: String = "",
    val method: String = "",
    val path: String = "",
    val ip: String = "",
    @SerialName("user_agent")
    val userAgent: String = "",
    @SerialName("created_at")
    val createdAt: String = ""
)

@Serializable
data class SuperadminOverviewResponse(
    val ok: Boolean = false,
    @SerialName("current_admin")
    val currentAdmin: ManagedCurrentAdmin? = null,
    val admins: List<ManagedAdmin> = emptyList(),
    @SerialName("audit_logs")
    val auditLogs: List<AdminAuditLog> = emptyList(),
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class CreateManagedAdminRequest(
    val username: String,
    val email: String,
    val password: String,
    val role: String
)

@Serializable
data class ChangeAdminPasswordRequest(
    @SerialName("current_password")
    val currentPassword: String,
    @SerialName("new_password")
    val newPassword: String,
    @SerialName("confirm_password")
    val confirmPassword: String
)
