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
                    text = "Superadmin",
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.weight(1f)
                )
                OutlinedButton(
                    onClick = onRefresh,
                    enabled = !state.loading
                ) {
                    Text("Refresh", maxLines = 1, softWrap = false)
                }
            }
        }

        item {
            Text(
                text = "Create Admin",
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
                        label = { Text("Username") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email Address") },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password
                        ),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text("Role")
                        OutlinedButton(
                            onClick = { roleExpanded = true },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = role,
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
                                    text = { Text(option) },
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
                            text = "Create Admin",
                            maxLines = 1,
                            softWrap = false
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                }
            }
        }

        state.error?.takeIf { it.isNotBlank() }?.let { message ->
            item {
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }

        state.lastAdminAction?.takeIf { it.isNotBlank() }?.let { message ->
            item {
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        item {
            Text(
                text = "Admin Management",
                style = MaterialTheme.typography.titleLarge
            )
        }

        if (state.managedAdmins.isEmpty()) {
            item {
                Text("No administrators found.")
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
                    onToggle = onToggle,
                    onDelete = onDelete
                )
            }
        }

        item {
            Text(
                text = "Website Login and Action Data",
                style = MaterialTheme.typography.titleLarge
            )
            Text(
                text = "Only the last 30 days are kept.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (state.adminAuditLogs.isEmpty()) {
            item {
                Text("No audit records found.")
            }
        } else {
            items(
                items = state.adminAuditLogs,
                key = { it.id }
            ) { log ->
                AdminAuditLogCard(log)
            }
        }
    }
}

@Composable
private fun ManagedAdminCard(
    admin: ManagedAdmin,
    currentUsername: String,
    enabled: Boolean,
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
            Text("Email: ${admin.email.ifBlank { "-" }}")
            Text("Role: ${admin.role}")
            Text("Active: ${if (admin.isActive) "Yes" else "No"}")
            Text("Source: ${admin.source.ifBlank { "-" }}")
            Text("Created: ${admin.createdAt.ifBlank { "-" }}")
            Text("Last Login: ${admin.lastLoginAt.ifBlank { "-" }}")

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
                        text = if (admin.isActive) {
                            "Deny access"
                        } else {
                            "Grant access"
                        },
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
                        text = "Delete credential",
                        maxLines = 1,
                        softWrap = false
                    )
                }
            } else if (admin.protected) {
                Text(
                    text = "Protected administrator",
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun AdminAuditLogCard(log: AdminAuditLog) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = log.actionType.ifBlank { "Action" },
                style = MaterialTheme.typography.titleMedium
            )
            Text("Created: ${log.createdAt.ifBlank { "-" }}")
            Text("Username: ${log.username.ifBlank { "-" }}")
            Text("Role: ${log.role.ifBlank { "-" }}")
            Text("Details: ${log.actionDetail.ifBlank { "-" }}")
            Text("Method: ${log.method.ifBlank { "-" }}")
            Text("Path: ${log.path.ifBlank { "-" }}")
            Text("IP: ${log.ip.ifBlank { "-" }}")
            Text("User Agent: ${log.userAgent.ifBlank { "-" }}")
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

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Change Admin Password",
                style = MaterialTheme.typography.headlineSmall
            )
        }

        state.error?.takeIf { it.isNotBlank() }?.let { message ->
            item {
                Text(
                    text = message,
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
                        label = { Text("Current Password") },
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
                        label = { Text("New Password") },
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
                        label = { Text("Confirm New Password") },
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
                            text = "Change Password",
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }
        }
    }
}
