const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');

// ============================================
// CONFIG - ALLEEN ENVIRONMENT VARIABLES
// ============================================
const CONFIG = {
    GENERAL_CATEGORY_ID: process.env.GENERAL_CATEGORY_ID,
    PURCHASE_CATEGORY_ID: process.env.PURCHASE_CATEGORY_ID,
    BUY_SUPPORT_CATEGORY_ID: process.env.BUY_SUPPORT_CATEGORY_ID,
    
    SUPPORT_ROLE_ID: process.env.SUPPORT_ROLE_ID || '1509664538281381908',
    BOTMSG_ROLE_ID: process.env.BOTMSG_ROLE_ID,
    TRANSCRIPT_CHANNEL_ID: process.env.TRANSCRIPT_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    
    TICKET_CREATION_CHANNEL_ID: process.env.TICKET_CREATION_CHANNEL_ID,
    
    VERIFIED_ROLE_ID: process.env.VERIFIED_ROLE_ID,
    UNVERIFIED_ROLE_ID: process.env.UNVERIFIED_ROLE_ID,
    VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID,
    
    TOKEN: process.env.TOKEN
};

// ============================================
// BOT INITIALIZATION
// ============================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(3000, () => console.log('Keep-alive server running on port 3000'));

const tickets = new Map();
const joinedMembers = new Set();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// HELPER FUNCTIONS
// ============================================
async function createTicketChannel(user, interaction, categoryId, ticketType) {
    const guild = interaction.guild;
    const supportRole = guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
    
    let prefix = '';
    switch(ticketType) {
        case 'General Question': prefix = 'general'; break;
        case 'Purchase': prefix = 'purchase'; break;
        case 'Buy Support': prefix = 'buysupport'; break;
        default: prefix = 'ticket';
    }
    
    const channel = await guild.channels.create({
        name: `${prefix}-${user.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ]
    });
    
    tickets.set(channel.id, {
        userId: user.id,
        claimedBy: null,
        createdAt: Date.now(),
        ticketType: ticketType
    });
    
    const embed = new EmbedBuilder()
        .setTitle(`🎫 ${ticketType} Ticket`)
        .setDescription(`Welcome ${user.toString()}! Your ticket has been created.\n\n**Ticket Type:** ${ticketType}\n**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n\nSupport team will assist you shortly.`)
        .setColor(0x00ff00)
        .addFields(
            { name: '📌 Instructions', value: '• Click **Claim Ticket** to take ownership\n• Click **Close Ticket** to delete this ticket\n• Click **Get Transcript** to save the conversation', inline: false },
            { name: '👤 User', value: user.toString(), inline: true }
        )
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('transcript').setLabel('Get Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄')
        );
    
    await channel.send({ content: `${user.toString()} ${supportRole.toString()}`, embeds: [embed], components: [row] });
    return channel;
}

async function sendTranscript(channel, interaction) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const ticketData = tickets.get(channel.id);
    let transcript = `Ticket Transcript: ${channel.name}\nTicket Type: ${ticketData?.ticketType || 'Unknown'}\nCreated: ${new Date(ticketData?.createdAt || Date.now()).toLocaleString()}\nClosed: ${new Date().toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    messages.reverse().forEach(msg => {
        transcript += `[${msg.author.tag}] (${msg.createdAt.toLocaleString()}): ${msg.content || '(embed/attachment)'}\n`;
    });
    
    const transcriptChannel = interaction.guild.channels.cache.get(CONFIG.TRANSCRIPT_CHANNEL_ID);
    if (transcriptChannel) {
        const embed = new EmbedBuilder()
            .setTitle('📝 Ticket Transcript')
            .setDescription(`Transcript for ${channel.name}\n**Ticket Type:** ${ticketData?.ticketType || 'Unknown'}`)
            .setColor(0x00aaff)
            .addFields(
                { name: 'User', value: `<@${ticketData.userId}>`, inline: true },
                { name: 'Created', value: `<t:${Math.floor(ticketData.createdAt / 1000)}:F>`, inline: true }
            )
            .setTimestamp();
        
        await transcriptChannel.send({ embeds: [embed], files: [{ attachment: Buffer.from(transcript, 'utf-8'), name: `${channel.name}-transcript.txt` }] });
    }
}

// ============================================
// VERIFICATION SYSTEM
// ============================================
async function sendVerificationMessage(guild) {
    const verificationChannel = guild.channels.cache.get(CONFIG.VERIFICATION_CHANNEL_ID);
    if (!verificationChannel) return;
    
    const messages = await verificationChannel.messages.fetch();
    if (messages.size > 0) await verificationChannel.bulkDelete(messages).catch(() => {});
    
    const embed = new EmbedBuilder()
        .setTitle('✅ Verification Required')
        .setDescription('Welcome! Please verify yourself to access the server.')
        .setColor(0x00ff00)
        .addFields(
            { name: '📋 Why verify?', value: 'This keeps the server safe from bots.', inline: false },
            { name: '⚠️ Important', value: 'You have 10 minutes to verify before being kicked.', inline: true }
        )
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(new ButtonBuilder().setCustomId('verify_button').setLabel('Verify Me').setStyle(ButtonStyle.Success).setEmoji('✅'));
    
    await verificationChannel.send({ embeds: [embed], components: [row] });
    console.log('✅ Verification message sent!');
}

// ============================================
// READY EVENT - GEEN RATE LIMIT RISICO
// ============================================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('Ready for /botmessage', { type: 'LISTENING' });
    
    setInterval(() => {
        client.user.setActivity('Ready for /botmessage', { type: 'LISTENING' });
    }, 300000);
    
    const guild = client.guilds.cache.first();
    if (!guild) return;
    
    // Alleen verificatie bericht sturen - GEEN rollen of DMs naar bestaande leden
    await sendVerificationMessage(guild);
    
    // Ticket channel setup
    const ticketChannel = client.channels.cache.get(CONFIG.TICKET_CREATION_CHANNEL_ID);
    if (ticketChannel) {
        const messages = await ticketChannel.messages.fetch();
        if (messages.size > 0) await ticketChannel.bulkDelete(messages).catch(() => {});
        
        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket System')
            .setDescription('Click the button below to create a support ticket.')
            .setColor(0x00ff00)
            .addFields(
                { name: '📋 How it works', value: '1. Click the button\n2. Choose your ticket type\n3. A private channel will be created', inline: false }
            )
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(new ButtonBuilder().setCustomId('create_ticket_menu').setLabel('Create Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫'));
        
        await ticketChannel.send({ embeds: [embed], components: [row] });
        console.log('✅ Ticket creation embed set up!');
    }
    
    console.log('✅ Bot is fully ready!');
});

// ============================================
// WELCOME DM - ALLEEN VOOR NIEUWE LEDEN
// ============================================
client.on('guildMemberAdd', async (member) => {
    if (joinedMembers.has(member.id)) return;
    
    try {
        const unverifiedRole = member.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
        if (unverifiedRole) await member.roles.add(unverifiedRole);
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Welcome!')
            .setDescription(`Hello ${member.user.username}! Welcome to the community.\n\nPlease verify yourself in <#${CONFIG.VERIFICATION_CHANNEL_ID}> to access all channels.`)
            .setColor(0x00ff00)
            .setTimestamp();
        
        await member.send({ embeds: [welcomeEmbed] });
        joinedMembers.add(member.id);
        console.log(`📨 Sent welcome DM to ${member.user.tag}`);
        
        // Auto-kick na 10 minuten
        setTimeout(async () => {
            const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
            if (freshMember && !freshMember.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
                await freshMember.kick('Did not verify within 10 minutes').catch(() => {});
                console.log(`⏰ Kicked ${member.user.tag} for not verifying`);
            }
        }, 10 * 60 * 1000);
        
    } catch (error) {
        console.log(`Couldn't send welcome DM to ${member.user.tag}: ${error.message}`);
    }
});

// ============================================
// VERIFICATION BUTTON
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'verify_button') return;
    
    const verifiedRole = interaction.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
    const unverifiedRole = interaction.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
    
    if (!verifiedRole) return interaction.reply({ content: '❌ Verification role not configured!', ephemeral: true });
    if (interaction.member.roles.cache.has(verifiedRole.id)) return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
    
    await interaction.member.roles.add(verifiedRole);
    if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
    
    await interaction.reply({ content: '✅ You have been verified! Welcome to the server!', ephemeral: true });
    console.log(`✅ Verified ${interaction.user.tag}`);
});

// ============================================
// /BOTMESSAGE COMMAND
// ============================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.toLowerCase().startsWith('/botmessage ')) {
        // Permission check
        if (!message.member.roles.cache.has(CONFIG.BOTMSG_ROLE_ID)) {
            const errorMsg = await message.reply({ content: '❌ You do not have permission to use `/botmessage`.', allowedMentions: { repliedUser: false } });
            setTimeout(async () => {
                await message.delete().catch(() => {});
                await errorMsg.delete().catch(() => {});
            }, 3000);
            return;
        }
        
        const msgContent = message.content.slice(11);
        if (!msgContent || msgContent.trim() === '') {
            const errorMsg = await message.reply({ content: '❌ Usage: `/botmessage your message here`', allowedMentions: { repliedUser: false } });
            setTimeout(async () => {
                await message.delete().catch(() => {});
                await errorMsg.delete().catch(() => {});
            }, 3000);
            return;
        }
        
        // Send as bot
        await message.channel.sendTyping();
        await delay(500);
        await message.delete().catch(() => {});
        
        const emptyEmbed = new EmbedBuilder()
            .setDescription(msgContent)
            .setColor(0x2b2d31);
        
        await message.channel.send({ embeds: [emptyEmbed] });
        console.log(`✅ Sent /botmessage in #${message.channel.name} by ${message.author.tag}`);
    }
});

// ============================================
// TICKET BUTTONS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Ticket menu
    if (interaction.customId === 'create_ticket_menu') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Create a Support Ticket')
            .setDescription('Select the category that best fits your needs:')
            .setColor(0x00ff00)
            .addFields(
                { name: '📋 General Question', value: 'General inquiries', inline: false },
                { name: '💰 Purchase', value: 'Payment issues', inline: false },
                { name: '🛡️ Buy Support', value: 'Premium support', inline: false }
            )
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('general_ticket').setLabel('General Question').setStyle(ButtonStyle.Primary).setEmoji('📋'),
                new ButtonBuilder().setCustomId('purchase_ticket').setLabel('Purchase').setStyle(ButtonStyle.Success).setEmoji('💰'),
                new ButtonBuilder().setCustomId('buysupport_ticket').setLabel('Buy Support').setStyle(ButtonStyle.Danger).setEmoji('🛡️')
            );
        
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        return;
    }
    
    // Ticket creation
    let categoryId = null, ticketType = null;
    if (interaction.customId === 'general_ticket') { categoryId = CONFIG.GENERAL_CATEGORY_ID; ticketType = 'General Question'; }
    else if (interaction.customId === 'purchase_ticket') { categoryId = CONFIG.PURCHASE_CATEGORY_ID; ticketType = 'Purchase'; }
    else if (interaction.customId === 'buysupport_ticket') { categoryId = CONFIG.BUY_SUPPORT_CATEGORY_ID; ticketType = 'Buy Support'; }
    
    if (categoryId && ticketType) {
        // Check for existing ticket
        for (const [channelId, data] of tickets.entries()) {
            if (data.userId === interaction.user.id) {
                const existing = interaction.guild.channels.cache.get(channelId);
                if (existing) return interaction.reply({ content: `❌ You already have an open ticket: ${existing.toString()}!`, ephemeral: true });
            }
        }
        
        await interaction.reply({ content: `🎫 Creating your ${ticketType} ticket...`, ephemeral: true });
        const channel = await createTicketChannel(interaction.user, interaction, categoryId, ticketType);
        await interaction.editReply({ content: `✅ ${ticketType} ticket created: ${channel.toString()}`, ephemeral: true });
    }
    
    // Ticket management buttons
    const ticketData = tickets.get(interaction.channelId);
    if (!ticketData) return;
    
    if (interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID)) return interaction.reply({ content: '❌ No permission!', ephemeral: true });
        if (ticketData.claimedBy) return interaction.reply({ content: '❌ Already claimed!', ephemeral: true });
        
        ticketData.claimedBy = interaction.user.id;
        tickets.set(interaction.channelId, ticketData);
        
        await interaction.reply({ content: `🎯 ${interaction.user.tag} claimed this ticket!`, ephemeral: true });
        
        const user = await interaction.guild.members.fetch(ticketData.userId).catch(() => null);
        if (user) await user.send({ content: `✅ Your ticket has been claimed by ${interaction.user.tag}!` }).catch(() => {});
    }
    
    if (interaction.customId === 'close_ticket') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticketData.userId === interaction.user.id;
        if (!hasPerm) return interaction.reply({ content: '❌ No permission!', ephemeral: true });
        
        await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...', ephemeral: true });
        setTimeout(async () => {
            await sendTranscript(interaction.channel, interaction);
            await interaction.channel.delete();
            tickets.delete(interaction.channelId);
        }, 5000);
    }
    
    if (interaction.customId === 'transcript') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticketData.userId === interaction.user.id;
        if (!hasPerm) return interaction.reply({ content: '❌ No permission!', ephemeral: true });
        
        await interaction.reply({ content: '📄 Generating transcript...', ephemeral: true });
        await sendTranscript(interaction.channel, interaction);
        await interaction.editReply({ content: '✅ Transcript sent!', ephemeral: true });
    }
});

client.login(CONFIG.TOKEN);
