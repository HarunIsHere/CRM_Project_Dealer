package me.ayartuerk.crmadmin.ui.design

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object AdminColors {
    val Background = Color(0xFFF4F6F8)
    val Surface = Color(0xFFFFFFFF)
    val Primary = Color(0xFF2563EB)
    val PrimaryPressed = Color(0xFF1D4ED8)
    val Danger = Color(0xFFDC2626)
    val Success = Color(0xFF16A34A)
    val Warning = Color(0xFFD97706)
    val TextPrimary = Color(0xFF1F2937)
    val TextSecondary = Color(0xFF6B7280)
    val Border = Color(0xFFD9DEE7)
    val InfoBackground = Color(0xFFEEF2FF)
    val InfoText = Color(0xFF1E3A8A)
}

object AdminSpacing {
    val XXS = 4.dp
    val XS = 8.dp
    val S = 12.dp
    val M = 16.dp
    val L = 24.dp
    val XL = 32.dp
}

object AdminShapes {
    val Panel = RoundedCornerShape(14.dp)
    val Control = RoundedCornerShape(10.dp)
    val Chip = RoundedCornerShape(999.dp)
}

@Composable
fun AdminPanel(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = AdminShapes.Panel,
        border = BorderStroke(1.dp, AdminColors.Border),
        colors = CardDefaults.cardColors(
            containerColor = AdminColors.Surface
        )
    ) {
        Column(
            modifier = Modifier.padding(AdminSpacing.M),
            verticalArrangement = Arrangement.spacedBy(AdminSpacing.S)
        ) {
            content()
        }
    }
}

@Composable
fun AdminPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        modifier = modifier.heightIn(min = 48.dp),
        enabled = enabled,
        shape = AdminShapes.Control,
        colors = ButtonDefaults.buttonColors(
            containerColor = AdminColors.Primary
        )
    ) {
        Text(text)
    }
}

@Composable
fun AdminSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = 48.dp),
        enabled = enabled,
        shape = AdminShapes.Control,
        border = BorderStroke(1.dp, AdminColors.Primary)
    ) {
        Text(text, color = AdminColors.Primary)
    }
}

@Composable
fun AdminDangerButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        modifier = modifier.heightIn(min = 48.dp),
        enabled = enabled,
        shape = AdminShapes.Control,
        colors = ButtonDefaults.buttonColors(
            containerColor = AdminColors.Danger
        )
    ) {
        Text(text)
    }
}

@Composable
fun AdminStatusChip(
    text: String,
    modifier: Modifier = Modifier
) {
    val normalized = text.lowercase()

    val color = when {
        normalized.contains("delivered") ||
        normalized.contains("picked up") ||
        normalized.contains("approved") ||
        normalized == "active" -> AdminColors.Success

        normalized.contains("cancel") ||
        normalized.contains("rejected") ||
        normalized.contains("not delivered") -> AdminColors.Danger

        normalized.contains("pending") ||
        normalized.contains("progress") -> AdminColors.Warning

        else -> AdminColors.Primary
    }

    Surface(
        modifier = modifier,
        shape = AdminShapes.Chip,
        color = color.copy(alpha = 0.12f)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(
                horizontal = AdminSpacing.S,
                vertical = AdminSpacing.XXS
            ),
            color = color,
            style = MaterialTheme.typography.labelMedium
        )
    }
}
