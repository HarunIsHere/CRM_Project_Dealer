package me.ayartuerk.crmadmin.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import me.ayartuerk.crmadmin.api.AdminAuditLog
import me.ayartuerk.crmadmin.api.ManagedAdmin

@Composable
fun SuperadminManagementScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onCreate: (String, String, String, String) -> Unit,
    onToggle: (Long) -> Unit,
    onDelete: (Long) -> Unit
) {
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("admin") }
    var roleExpanded by remember { mutableStateOf(false) }
    val languageCode = resolveAdminLanguage(state.settings["admin_view_language"])

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = AdminSharedTexts.text(languageCode, "superadmin"),
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.weight(1f)
                )
                OutlinedButton(
                    onClick = onRefresh,
                    enabled = !state.loading
                ) {
                    Text(AdminSharedTexts.text(languageCode, "refresh"), maxLines = 1, softWrap = false)
                }
            }
        }

        item {
            Text(
                text = AdminSharedTexts.text(languageCode, "create_admin"),
                style = MaterialTheme.typography.titleLarge
            )
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Spacer(modifier = Modifier.height(4.dp))

                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text(AdminSharedTexts.text(languageCode, "username")) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text(AdminSharedTexts.text(languageCode, "email_address")) },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text(AdminSharedTexts.text(languageCode, "password")) },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password
                        ),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(AdminSharedTexts.text(languageCode, "role"))
                        OutlinedButton(
                            onClick = { roleExpanded = true },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = AdminSharedTexts.text(
                                    languageCode,
                                    if (role == "superadmin") "role_superadmin" else "role_admin"
                                ),
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                        DropdownMenu(
                            expanded = roleExpanded,
                            onDismissRequest = { roleExpanded = false }
                        ) {
                            listOf("admin", "superadmin").forEach { option ->
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            AdminSharedTexts.text(
                                                languageCode,
                                                if (option == "superadmin") {
                                                    "role_superadmin"
                                                } else {
                                                    "role_admin"
                                                }
                                            )
                                        )
                                    },
                                    onClick = {
                                        role = option
                                        roleExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    Button(
                        onClick = {
                            onCreate(
                                username,
                                email,
                                password,
                                role
                            )
                        },
                        enabled = !state.loading,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = AdminSharedTexts.text(languageCode, "create_admin"),
                            maxLines = 1,
                            softWrap = false
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                }
            }
        }

        state.error?.let { message ->
            item {
                Text(
                    text = localizedAdminMessage(message, languageCode).orEmpty(),
                    color = MaterialTheme.colorScheme.error
                )
            }
        }

        state.lastAdminAction?.let { message ->
            item {
                Text(
                    text = localizedAdminMessage(message, languageCode).orEmpty(),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        item {
            Text(
                text = AdminSharedTexts.text(languageCode, "admin_management"),
                style = MaterialTheme.typography.titleLarge
            )
        }

        if (state.managedAdmins.isEmpty()) {
            item {
                Text(AdminSharedTexts.text(languageCode, "no_administrators_found"))
            }
        } else {
            items(
                items = state.managedAdmins,
                key = { "${it.id}:${it.username}" }
            ) { admin ->
                ManagedAdminCard(
                    admin = admin,
                    currentUsername = state.currentAdminUsername,
                    enabled = !state.loading,
                    languageCode = languageCode,
                    onToggle = onToggle,
                    onDelete = onDelete
                )
            }
        }

        item {
            Text(
                text = AdminSharedTexts.text(languageCode, "audit_logs"),
                style = MaterialTheme.typography.titleLarge
            )
            Text(
                text = AdminSharedTexts.text(languageCode, "last_30_days_only"),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (state.adminAuditLogs.isEmpty()) {
            item {
                Text(AdminSharedTexts.text(languageCode, "no_audit_records_found"))
            }
        } else {
            items(
                items = state.adminAuditLogs,
                key = { it.id }
            ) { log ->
                AdminAuditLogCard(log, languageCode)
            }
        }
    }
}

@Composable
private fun ManagedAdminCard(
    admin: ManagedAdmin,
    currentUsername: String,
    enabled: Boolean,
    languageCode: String,
    onToggle: (Long) -> Unit,
    onDelete: (Long) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = admin.username.ifBlank { "-" },
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                "${AdminSharedTexts.text(languageCode, "email_address")}: " +
                    admin.email.ifBlank { "-" }
            )
            Text(
                "${AdminSharedTexts.text(languageCode, "role")}: " +
                    AdminSharedTexts.text(
                        languageCode,
                        if (admin.role == "superadmin") "role_superadmin" else "role_admin"
                    )
            )
            Text(
                "${AdminSharedTexts.text(languageCode, "active")}: " +
                    AdminSharedTexts.text(
                        languageCode,
                        if (admin.isActive) "yes" else "no"
                    )
            )
            Text(
                "${AdminSharedTexts.text(languageCode, "source")}: " +
                    admin.source.ifBlank { "-" }
            )
            Text(
                "${AdminSharedTexts.text(languageCode, "created_at")}: " +
                    admin.createdAt.ifBlank { "-" }
            )
            Text(
                "${AdminSharedTexts.text(languageCode, "last_login_at")}: " +
                    admin.lastLoginAt.ifBlank { "-" }
            )

            val canManage =
                admin.id != null &&
                !admin.protected &&
                !admin.username.equals(currentUsername, ignoreCase = true)

            if (canManage) {
                OutlinedButton(
                    onClick = { onToggle(admin.id!!) },
                    enabled = enabled,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = AdminSharedTexts.text(
                            languageCode,
                            if (admin.isActive) "deny_access" else "grant_access"
                        ),
                        maxLines = 1,
                        softWrap = false
                    )
                }

                Button(
                    onClick = { onDelete(admin.id!!) },
                    enabled = enabled,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = AdminSharedTexts.text(languageCode, "delete_credential"),
                        maxLines = 1,
                        softWrap = false
                    )
                }
            } else if (admin.protected) {
                Text(
                    text = AdminSharedTexts.text(languageCode, "protected_administrator"),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun AdminAuditLogCard(log: AdminAuditLog, languageCode: String) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = log.actionType.ifBlank {
                    AdminSharedTexts.text(languageCode, "action")
                },
                style = MaterialTheme.typography.titleMedium
            )
            Text("${AdminSharedTexts.text(languageCode, "created_at")}: ${log.createdAt.ifBlank { "-" }}")
            Text("${AdminSharedTexts.text(languageCode, "username")}: ${log.username.ifBlank { "-" }}")
            Text("${AdminSharedTexts.text(languageCode, "role")}: ${log.role.ifBlank { "-" }}")
            Text("${AdminSharedTexts.text(languageCode, "details")}: ${log.actionDetail.ifBlank { "-" }}")
            Text("${AdminSharedTexts.text(languageCode, "method")}: ${log.method.ifBlank { "-" }}")
            Text("${AdminSharedTexts.text(languageCode, "path")}: ${log.path.ifBlank { "-" }}")
            Text("${AdminSharedTexts.text(languageCode, "ip_address")}: ${log.ip.ifBlank { "-" }}")
            Text("${AdminSharedTexts.text(languageCode, "user_agent")}: ${log.userAgent.ifBlank { "-" }}")
        }
    }
}

@Composable
fun AdminChangePasswordScreen(
    state: AdminUiState,
    onSubmit: (String, String, String) -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    val languageCode = resolveAdminLanguage(state.settings["admin_view_language"])

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = AdminSharedTexts.text(languageCode, "change_admin_password"),
                style = MaterialTheme.typography.headlineSmall
            )
        }

        state.error?.let { message ->
            item {
                Text(
                    text = localizedAdminMessage(message, languageCode).orEmpty(),
                    color = MaterialTheme.colorScheme.error
                )
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = currentPassword,
                        onValueChange = { currentPassword = it },
                        label = { Text(AdminSharedTexts.text(languageCode, "current_password")) },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password
                        ),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text(AdminSharedTexts.text(languageCode, "auth_recovery_new_password")) },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password
                        ),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text(AdminSharedTexts.text(languageCode, "auth_recovery_confirm_password")) },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password
                        ),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            onSubmit(
                                currentPassword,
                                newPassword,
                                confirmPassword
                            )
                        },
                        enabled = !state.loading,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = AdminSharedTexts.text(languageCode, "change_password"),
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }
        }
    }
}
