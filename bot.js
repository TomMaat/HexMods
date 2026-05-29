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
    SEND_ROLE_ID: process.env.SEND_ROLE_ID,
    PRODUCT_ROLE_ID: process.env.PRODUCT_ROLE_ID,
    CLEAR_ROLE_ID: process.env.CLEAR_ROLE_ID,
    REVIEW_ROLE_ID: process.env.REVIEW_ROLE_ID,
    REVIEW_CHANNEL_ID: process.env.REVIEW_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID: process.env.TRANSCRIPT_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    
    TICKET_CREATION_CHANNEL_ID: process.env.TICKET_CREATION_CHANNEL_ID,
    ROLE_CLAIM_CHANNEL_ID: process.env.ROLE_CLAIM_CHANNEL_ID,  // NEW: Channel for role claim embed
    
    VERIFIED_ROLE_ID: process.env.VERIFIED_ROLE_ID,
    UNVERIFIED_ROLE_ID: process.env.UNVERIFIED_ROLE_ID,
    VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID,
    
    // Role Claim Roles
    SPOOF_ACCOUNTS_ROLE_ID: process.env.SPOOF_ACCOUNTS_ROLE_ID,
    TRIGGER_SHOP_ROLE_ID: process.env.TRIGGER_SHOP_ROLE_ID,
    SCRIPTS_ROLE_ID: process.env.SCRIPTS_ROLE_ID,
    CHEATS_SOFTWARE_ROLE_ID: process.env.CHEATS_SOFTWARE_ROLE_ID,
    
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
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences
    ]
});

const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(3000, () => console.log('Keep-alive server running on port 3000'));

const tickets = new Map();
const joinedMembers = new Set();

// ============================================
// UPDATE MEMBER COUNT IN STATUS
// ============================================
async function updateMemberCount(guild) {
    try {
        await guild.members.fetch({ force: true });
        
        const humanMembers = guild.members.cache.filter(member => !member.user.bot);
        const memberCount = humanMembers.size;
        
        client.user.setPresence({
            activities: [{ name: `${memberCount} Members`, type: 3 }],
            status: 'online'
        });
        
        console.log(`✅ Status updated: Watching ${memberCount} Members`);
        
        return memberCount;
    } catch (error) {
        console.log(`❌ Could not update member count: ${error.message}`);
    }
}

// ============================================
// REGISTER SLASH COMMANDS
// ============================================
async function registerCommands(guild) {
    const commands = [
        {
            name: 'send',
            description: 'Send a message as the bot',
            options: [
                {
                    name: 'message',
                    description: 'The message to send',
                    type: 3,
                    required: true
                }
            ]
        },
        {
            name: 'product',
            description: 'Create a product embed',
            options: [
                {
                    name: 'name',
                    description: 'The product name',
                    type: 3,
                    required: true
                },
                {
                    name: 'instock',
                    description: 'Is the product in stock? (yes/no)',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Yes ✅', value: 'yes' },
                        { name: 'No ❌', value: 'no' }
                    ]
                },
                {
                    name: 'price',
                    description: 'The product price',
                    type: 3,
                    required: true
                },
                {
                    name: 'description',
                    description: 'Product description',
                    type: 3,
                    required: false
                },
                {
                    name: 'image',
                    description: 'Image URL for the product',
                    type: 3,
                    required: false
                }
            ]
        },
        {
            name: 'clear',
            description: 'Clear messages from the channel',
            options: [
                {
                    name: 'amount',
                    description: 'Number of messages to clear (1-100)',
                    type: 4,
                    required: true
                }
            ]
        },
        {
            name: 'review',
            description: 'Leave a review for a product',
            options: [
                {
                    name: 'stars',
                    description: 'Number of stars (1-5)',
                    type: 4,
                    required: true,
                    choices: [
                        { name: '⭐ 1 star', value: 1 },
                        { name: '⭐⭐ 2 stars', value: 2 },
                        { name: '⭐⭐⭐ 3 stars', value: 3 },
                        { name: '⭐⭐⭐⭐ 4 stars', value: 4 },
                        { name: '⭐⭐⭐⭐⭐ 5 stars', value: 5 }
                    ]
                },
                {
                    name: 'product',
                    description: 'What product did you buy?',
                    type: 3,
                    required: true
                },
                {
                    name: 'review',
                    description: 'Your review message',
                    type: 3,
                    required: true
                }
            ]
        }
    ];
    
    await guild.commands.set(commands);
    console.log('✅ Slash commands registered!');
}

// ============================================
// DELETE ALL OLD SLASH COMMANDS
// ============================================
async function deleteAllSlashCommands(guild) {
    try {
        const commands = await guild.commands.fetch();
        for (const command of commands.values()) {
            if (command.name !== 'send' && command.name !== 'product' && command.name !== 'clear' && command.name !== 'review') {
                await guild.commands.delete(command.id);
                console.log(`🗑️ Deleted: /${command.name}`);
            }
        }
        console.log('✅ Old commands removed!');
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

// ============================================
// ROLE CLAIM EMBED SETUP
// ============================================
async function sendRoleClaimMessage(guild) {
    const roleClaimChannel = guild.channels.cache.get(CONFIG.ROLE_CLAIM_CHANNEL_ID);
    if (!roleClaimChannel) {
        console.log('❌ Role claim channel not found!');
        return;
    }
    
    // Clear previous messages
    const messages = await roleClaimChannel.messages.fetch();
    if (messages.size > 0) await roleClaimChannel.bulkDelete(messages).catch(() => {});
    
    const embed = new EmbedBuilder()
        .setTitle('🎭 **Claim Your Roles**')
        .setDescription('Click the buttons below to claim roles and access specific content channels!\n\n*You can claim multiple roles.*')
        .setColor(0x5865F2)
        .addFields(
            { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '⬇️ **Available Roles** ⬇️', inline: false },
            { name: '🎭 **Spoof Accounts**', value: 'Access to spoof account discussions and resources', inline: true },
            { name: '🛒 **Trigger Shop**', value: 'Access to trigger shop and related content', inline: true },
            { name: '📜 **Scripts**', value: 'Access to script sharing and discussions', inline: true },
            { name: '💻 **Cheats/Software**', value: 'Access to cheats and software channels', inline: true }
        )
        .setThumbnail(guild.iconURL())
        .setFooter({ text: 'Click any button to claim/unclaim a role', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_spoof')
                .setLabel('Spoof Accounts')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎭'),
            new ButtonBuilder()
                .setCustomId('claim_trigger')
                .setLabel('Trigger Shop')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛒'),
            new ButtonBuilder()
                .setCustomId('claim_scripts')
                .setLabel('Scripts')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📜'),
            new ButtonBuilder()
                .setCustomId('claim_cheats')
                .setLabel('Cheats/Software')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('💻')
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_all')
                .setLabel('Claim All Roles')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('unclaim_all')
                .setLabel('Remove All Roles')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );
    
    await roleClaimChannel.send({ embeds: [embed], components: [row, row2] });
    console.log('✅ Role claim message sent!');
}

// ============================================
// CREATE DIRECT PURCHASE TICKET
// ============================================
async function createDirectTicket(user, interaction, productName, productPrice) {
    const guild = interaction.guild;
    const supportRole = guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
    const categoryId = CONFIG.PURCHASE_CATEGORY_ID;
    
    const channel = await guild.channels.create({
        name: `purchase-${user.username.toLowerCase()}`,
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
        ticketType: 'Purchase'
    });
    
    const embed = new EmbedBuilder()
        .setTitle(`🛒 Purchase Ticket`)
        .setDescription(`Welcome ${user.toString()}! Your purchase ticket has been created.\n\n**Product:** ${productName}\n**Price:** ${productPrice}\n**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n\nA support member will assist you with your purchase shortly.`)
        .setColor(0x00ff00)
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: '📌 Instructions', value: '• Click **Claim Ticket** to take ownership\n• Click **Close Ticket** to delete this ticket\n• Click **Get Transcript** to save the conversation', inline: false },
            { name: '👤 User', value: user.toString(), inline: true },
            { name: '🛒 Product', value: productName, inline: true },
            { name: '💰 Price', value: productPrice, inline: true }
        )
        .setFooter({ text: `Purchase Ticket System`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('transcript').setLabel('Get Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄')
        );
    
    await channel.send({
        content: `${user.toString()} ${supportRole.toString()}`,
        embeds: [embed],
        components: [row]
    });
    
    return channel;
}

// ============================================
// REGULAR TICKET FUNCTIONS
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
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: '📌 Instructions', value: '• Click **Claim Ticket** to take ownership\n• Click **Close Ticket** to delete this ticket\n• Click **Get Transcript** to save the conversation', inline: false },
            { name: '👤 User', value: user.toString(), inline: true }
        )
        .setFooter({ text: `Ticket System • ${ticketType}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('transcript').setLabel('Get Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄')
        );
    
    await channel.send({
        content: `${user.toString()} ${supportRole.toString()}`,
        embeds: [embed],
        components: [row]
    });
    
    return channel;
}

async function sendTranscript(channel, interaction) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const ticketData = tickets.get(channel.id);
    let transcript = `Ticket Transcript: ${channel.name}\n`;
    transcript += `Ticket Type: ${ticketData ? ticketData.ticketType : 'Unknown'}\n`;
    transcript += `Created: ${new Date(ticketData ? ticketData.createdAt : Date.now()).toLocaleString()}\n`;
    transcript += `Closed: ${new Date().toLocaleString()}\n`;
    transcript += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    messages.reverse().forEach(msg => {
        transcript += `[${msg.author.tag}] (${msg.createdAt.toLocaleString()}): ${msg.content || '(embed/attachment)'}\n`;
    });
    
    const transcriptChannel = interaction.guild.channels.cache.get(CONFIG.TRANSCRIPT_CHANNEL_ID);
    if (transcriptChannel) {
        const embed = new EmbedBuilder()
            .setTitle('📝 Ticket Transcript')
            .setDescription(`Transcript for ${channel.name}\n**Ticket Type:** ${ticketData ? ticketData.ticketType : 'Unknown'}`)
            .setColor(0x00aaff)
            .addFields(
                { name: 'User', value: `<@${ticketData.userId}>`, inline: true },
                { name: 'Created', value: `<t:${Math.floor(ticketData.createdAt / 1000)}:F>`, inline: true },
                { name: 'Closed', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();
        
        await transcriptChannel.send({
            content: `📄 **Transcript for ${channel.name}**`,
            embeds: [embed],
            files: [{
                attachment: Buffer.from(transcript, 'utf-8'),
                name: `${channel.name}-transcript.txt`
            }]
        });
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
        .setDescription('Welcome to the server! Please verify yourself to access the rest of the channels.')
        .setColor(0x00ff00)
        .addFields(
            { name: '📋 Why verify?', value: 'Verification helps us keep the server safe from bots and spam.', inline: false },
            { name: '🔓 What happens after?', value: 'You will get access to all channels and can participate in discussions.', inline: false },
            { name: '⚠️ Important', value: 'You have 24 hours to verify before being kicked.', inline: true }
        )
        .setThumbnail(guild.iconURL())
        .setFooter({ text: 'Click the button below to verify', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('Verify Me')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );
    
    await verificationChannel.send({ embeds: [embed], components: [row] });
    console.log('✅ Verification message sent!');
}

// ============================================
// READY EVENT
// ============================================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    const guild = client.guilds.cache.first();
    if (guild) {
        await updateMemberCount(guild);
        
        setInterval(async () => {
            await updateMemberCount(guild);
        }, 120000);
        
        await deleteAllSlashCommands(guild);
        await registerCommands(guild);
    }
    
    setInterval(() => {
        console.log('🔄 Keep-alive ping');
    }, 300000);
    
    if (!guild) return;
    
    await sendVerificationMessage(guild);
    await sendRoleClaimMessage(guild);  // NEW: Send role claim embed
    
    const ticketChannel = client.channels.cache.get(CONFIG.TICKET_CREATION_CHANNEL_ID);
    if (ticketChannel) {
        const messages = await ticketChannel.messages.fetch();
        if (messages.size > 0) await ticketChannel.bulkDelete(messages).catch(() => {});
        
        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket System')
            .setDescription('Welcome to our support system! Click the button below to get started and select the type of support you need.')
            .setColor(0x00ff00)
            .addFields(
                { name: '📋 How it works', value: '1. Click the button below\n2. Choose your ticket type\n3. A private channel will be created\n4. Support team will assist you', inline: false },
                { name: '⏱️ Response Time', value: 'Typically within 24 hours', inline: true },
                { name: '📜 Guidelines', value: 'Be respectful and patient', inline: true }
            )
            .setThumbnail(guild.iconURL())
            .setFooter({ text: 'Support System • Click below to start', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_menu')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎫')
            );
        
        await ticketChannel.send({ embeds: [embed], components: [row] });
        console.log('✅ Ticket creation embed set up!');
    }
    
    console.log('✅ Bot is fully ready!');
});

// ============================================
// ROLE CLAIM BUTTON HANDLERS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Spoof Accounts role
    if (interaction.customId === 'claim_spoof') {
        const role = interaction.guild.roles.cache.get(CONFIG.SPOOF_ACCOUNTS_ROLE_ID);
        if (!role) return interaction.reply({ content: '❌ Role not configured!', ephemeral: true });
        
        if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            await interaction.reply({ content: `✅ Removed role: **${role.name}**`, ephemeral: true });
        } else {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `✅ Added role: **${role.name}**`, ephemeral: true });
        }
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Trigger Shop role
    if (interaction.customId === 'claim_trigger') {
        const role = interaction.guild.roles.cache.get(CONFIG.TRIGGER_SHOP_ROLE_ID);
        if (!role) return interaction.reply({ content: '❌ Role not configured!', ephemeral: true });
        
        if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            await interaction.reply({ content: `✅ Removed role: **${role.name}**`, ephemeral: true });
        } else {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `✅ Added role: **${role.name}**`, ephemeral: true });
        }
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Scripts role
    if (interaction.customId === 'claim_scripts') {
        const role = interaction.guild.roles.cache.get(CONFIG.SCRIPTS_ROLE_ID);
        if (!role) return interaction.reply({ content: '❌ Role not configured!', ephemeral: true });
        
        if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            await interaction.reply({ content: `✅ Removed role: **${role.name}**`, ephemeral: true });
        } else {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `✅ Added role: **${role.name}**`, ephemeral: true });
        }
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Cheats/Software role
    if (interaction.customId === 'claim_cheats') {
        const role = interaction.guild.roles.cache.get(CONFIG.CHEATS_SOFTWARE_ROLE_ID);
        if (!role) return interaction.reply({ content: '❌ Role not configured!', ephemeral: true });
        
        if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            await interaction.reply({ content: `✅ Removed role: **${role.name}**`, ephemeral: true });
        } else {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `✅ Added role: **${role.name}**`, ephemeral: true });
        }
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Claim All Roles
    if (interaction.customId === 'claim_all') {
        const roles = [
            CONFIG.SPOOF_ACCOUNTS_ROLE_ID,
            CONFIG.TRIGGER_SHOP_ROLE_ID,
            CONFIG.SCRIPTS_ROLE_ID,
            CONFIG.CHEATS_SOFTWARE_ROLE_ID
        ];
        
        let added = 0;
        for (const roleId of roles) {
            const role = interaction.guild.roles.cache.get(roleId);
            if (role && !interaction.member.roles.cache.has(role.id)) {
                await interaction.member.roles.add(role);
                added++;
            }
        }
        
        await interaction.reply({ content: `✅ Added ${added} new role(s) to you!`, ephemeral: true });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Unclaim All Roles
    if (interaction.customId === 'unclaim_all') {
        const roles = [
            CONFIG.SPOOF_ACCOUNTS_ROLE_ID,
            CONFIG.TRIGGER_SHOP_ROLE_ID,
            CONFIG.SCRIPTS_ROLE_ID,
            CONFIG.CHEATS_SOFTWARE_ROLE_ID
        ];
        
        let removed = 0;
        for (const roleId of roles) {
            const role = interaction.guild.roles.cache.get(roleId);
            if (role && interaction.member.roles.cache.has(role.id)) {
                await interaction.member.roles.remove(role);
                removed++;
            }
        }
        
        await interaction.reply({ content: `✅ Removed ${removed} role(s) from you!`, ephemeral: true });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
});

// ============================================
// /SEND COMMAND
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'send') {
        if (!interaction.member.roles.cache.has(CONFIG.SEND_ROLE_ID)) {
            await interaction.reply({ content: '❌ No permission.', ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        
        const messageContent = interaction.options.getString('message');
        if (!messageContent || messageContent.trim() === '') {
            await interaction.reply({ content: '❌ Provide a message.', ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        
        await interaction.channel.send(messageContent);
        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply().catch(() => {});
        
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send({ content: `📝 /send by ${interaction.user.tag} in ${interaction.channel.name}` }).catch(() => {});
        }
    }
    
    // ============================================
    // /PRODUCT COMMAND
    // ============================================
    if (interaction.commandName === 'product') {
        if (!interaction.member.roles.cache.has(CONFIG.PRODUCT_ROLE_ID)) {
            await interaction.reply({ content: '❌ No permission.', ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        
        const productName = interaction.options.getString('name');
        const instockRaw = interaction.options.getString('instock');
        const price = interaction.options.getString('price');
        const description = interaction.options.getString('description') || 'No description provided';
        const imageUrl = interaction.options.getString('image');
        
        const inStock = instockRaw.toLowerCase() === 'yes';
        const stockStatus = inStock ? '✅ **IN STOCK**' : '❌ **OUT OF STOCK**';
        const stockColor = inStock ? 0x00ff00 : 0xff0000;
        
        const productEmbed = new EmbedBuilder()
            .setTitle(`${productName}`)
            .setDescription(description)
            .setColor(stockColor)
            .addFields(
                { name: '💰 **Price**', value: price, inline: true },
                { name: '📦 **Stock Status**', value: stockStatus, inline: true },
                { name: '📅 **Listed On**', value: new Date().toLocaleDateString(), inline: true },
                { name: '🛒 **How to Purchase**', value: 'Click the **Buy Now** button below to create a support ticket!', inline: false }
            )
            .setTimestamp();
        
        if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            productEmbed.setImage(imageUrl);
        }
        productEmbed.setThumbnail('https://cdn-icons-png.flaticon.com/512/2331/2331970.png');
        
        const buttonId = `buy_now_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buttonId)
                    .setLabel('Buy Now')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛒'),
                new ButtonBuilder()
                    .setCustomId('more_info')
                    .setLabel('More Info')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('❓')
            );
        
        if (!client.productData) client.productData = new Map();
        client.productData.set(buttonId, { name: productName, price: price });
        
        await interaction.channel.send({ embeds: [productEmbed], components: [row] });
        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply().catch(() => {});
        
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send({ content: `📝 /product by ${interaction.user.tag}: ${productName} - ${price}` }).catch(() => {});
        }
    }
    
    // ============================================
    // /CLEAR COMMAND
    // ============================================
    if (interaction.commandName === 'clear') {
        if (!interaction.member.roles.cache.has(CONFIG.CLEAR_ROLE_ID)) {
            await interaction.reply({ content: '❌ No permission.', ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        
        const amount = interaction.options.getInteger('amount');
        if (amount < 1 || amount > 100) {
            await interaction.reply({ content: '❌ Number between 1-100.', ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            if (messages.size === 0) {
                await interaction.editReply({ content: '❌ No messages to clear.' });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
                return;
            }
            
            await interaction.channel.bulkDelete(messages, true);
            await interaction.editReply({ content: `✅ Cleared ${messages.size} messages.` });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            
            const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
            if (logChannel) {
                logChannel.send({ content: `📝 /clear by ${interaction.user.tag} in ${interaction.channel.name}: ${messages.size} messages` }).catch(() => {});
            }
        } catch (error) {
            await interaction.editReply({ content: '❌ Failed. Messages may be older than 14 days.' });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        }
    }
    
    // ============================================
    // /REVIEW COMMAND
    // ============================================
    if (interaction.commandName === 'review') {
        if (!interaction.member.roles.cache.has(CONFIG.REVIEW_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to use `/review`.', ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const stars = interaction.options.getInteger('stars');
        const product = interaction.options.getString('product');
        const reviewText = interaction.options.getString('review');
        
        const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        
        let starColor = 0xff0000;
        if (stars === 3) starColor = 0xffaa00;
        if (stars >= 4) starColor = 0x00ff00;
        
        const reviewEmbed = new EmbedBuilder()
            .setTitle(`📝 Review for ${product}`)
            .setDescription(`"${reviewText}"`)
            .setColor(starColor)
            .addFields(
                { name: '⭐ Rating', value: `${starDisplay} (${stars}/5)`, inline: true },
                { name: '🛒 Product', value: product, inline: true },
                { name: '👤 Reviewer', value: interaction.user.tag, inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();
        
        const reviewChannel = interaction.guild.channels.cache.get(CONFIG.REVIEW_CHANNEL_ID);
        if (!reviewChannel) {
            await interaction.reply({ content: '❌ Review channel not configured!', ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        await reviewChannel.send({ embeds: [reviewEmbed] });
        await interaction.reply({ content: `✅ Your review for **${product}** has been posted! Thank you!`, ephemeral: true });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send({ content: `📝 /review by ${interaction.user.tag}: ${stars} stars for ${product}` }).catch(() => {});
        }
    }
});

// ============================================
// PRODUCT BUTTON HANDLERS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId.startsWith('buy_now_')) {
        const productData = client.productData?.get(interaction.customId);
        const productName = productData?.name || 'Unknown Product';
        const productPrice = productData?.price || 'Unknown Price';
        
        let existingTicket = null;
        for (const [channelId, data] of tickets.entries()) {
            if (data.userId === interaction.user.id) {
                existingTicket = interaction.guild.channels.cache.get(channelId);
                break;
            }
        }
        
        if (existingTicket) {
            await interaction.reply({ content: `❌ You already have an open ticket: ${existingTicket.toString()}`, ephemeral: true });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
            return;
        }
        
        await interaction.reply({ content: `🛒 Creating ticket for ${productName}...`, ephemeral: true });
        
        const channel = await createDirectTicket(interaction.user, interaction, productName, productPrice);
        
        await interaction.editReply({ content: `✅ Ticket created: ${channel.toString()}` });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        
        if (client.productData) client.productData.delete(interaction.customId);
    }
    
    if (interaction.customId === 'more_info') {
        const embed = new EmbedBuilder()
            .setTitle('❓ Product Information')
            .setDescription(`Click the **Buy Now** button to create a ticket and our team will assist you.`)
            .setColor(0x0099ff)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
    }
});

// ============================================
// WELCOME DM
// ============================================
client.on('guildMemberAdd', async (member) => {
    await updateMemberCount(member.guild);
    
    if (joinedMembers.has(member.id)) return;
    
    try {
        const unverifiedRole = member.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
        if (unverifiedRole) await member.roles.add(unverifiedRole);
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Welcome!')
            .setDescription(`Hello ${member.user.username}! Welcome to our community.\n\nPlease verify yourself in <#${CONFIG.VERIFICATION_CHANNEL_ID}> to access all channels.`)
            .setColor(0x00ff00)
            .addFields(
                { name: '📌 Need Help?', value: 'Use the **Ticket System** to create a support ticket.', inline: true },
                { name: '✅ Verify', value: 'Go to the verification channel and click the button!', inline: true },
                { name: '⏱️ Time Limit', value: 'You have 24 hours to verify.', inline: true }
            )
            .setThumbnail(member.guild.iconURL())
            .setTimestamp();
        
        await member.send({ embeds: [welcomeEmbed] });
        joinedMembers.add(member.id);
        console.log(`📨 Welcome DM to ${member.user.tag}`);
        
        setTimeout(async () => {
            const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
            if (freshMember && !freshMember.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
                await freshMember.kick('Did not verify within 24 hours').catch(() => {});
                console.log(`⏰ Kicked ${member.user.tag}`);
                await updateMemberCount(member.guild);
            }
        }, 24 * 60 * 60 * 1000);
        
    } catch (error) {
        console.log(`Couldn't DM ${member.user.tag}: ${error.message}`);
    }
});

// ============================================
// LEAVE UPDATE
// ============================================
client.on('guildMemberRemove', async (member) => {
    await updateMemberCount(member.guild);
});

// ============================================
// VERIFICATION BUTTON
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'verify_button') return;
    
    const verifiedRole = interaction.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
    const unverifiedRole = interaction.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
    
    if (!verifiedRole) return interaction.reply({ content: '❌ Role not configured!', ephemeral: true });
    if (interaction.member.roles.cache.has(verifiedRole.id)) return interaction.reply({ content: '✅ Already verified!', ephemeral: true });
    
    await interaction.member.roles.add(verifiedRole);
    if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
    
    const verifyEmbed = new EmbedBuilder()
        .setTitle('✅ Verified!')
        .setDescription(`Welcome ${interaction.user.toString()}! You now have access to all channels.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await interaction.reply({ embeds: [verifyEmbed], ephemeral: true });
    
    console.log(`✅ Verified ${interaction.user.tag}`);
});

// ============================================
// TICKET BUTTON HANDLERS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('buy_now_') || interaction.customId === 'more_info') return;
    if (interaction.customId === 'create_ticket_menu') return;
    if (interaction.customId === 'general_ticket' || interaction.customId === 'purchase_ticket' || interaction.customId === 'buysupport_ticket') return;
    if (interaction.customId.startsWith('claim_') || interaction.customId === 'claim_all' || interaction.customId === 'unclaim_all') return;
    if (interaction.customId === 'verify_button') return;
    
    const ticketData = tickets.get(interaction.channelId);
    if (!ticketData) return;
    
    if (interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID)) {
            return interaction.reply({ content: '❌ No permission!', ephemeral: true });
        }
        if (ticketData.claimedBy) {
            return interaction.reply({ content: '❌ Already claimed!', ephemeral: true });
        }
        
        ticketData.claimedBy = interaction.user.id;
        tickets.set(interaction.channelId, ticketData);
        
        const embed = new EmbedBuilder()
            .setTitle('🎯 Ticket Claimed')
            .setDescription(`${interaction.user.toString()} has claimed this ticket.`)
            .setColor(0xffaa00)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        const user = await interaction.guild.members.fetch(ticketData.userId).catch(() => null);
        if (user) {
            user.send({ content: `✅ Your ticket has been claimed by ${interaction.user.tag}!` }).catch(() => {});
        }
    }
    
    if (interaction.customId === 'close_ticket') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticketData.userId === interaction.user.id;
        if (!hasPerm) return interaction.reply({ content: '❌ No permission!', ephemeral: true });
        
        await interaction.reply({ content: '🔒 Closing in 5 seconds...' });
        
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
        await interaction.editReply({ content: '✅ Transcript sent!' });
    }
});

// ============================================
// TICKET CREATION BUTTONS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'create_ticket_menu') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Create a Support Ticket')
            .setDescription('Select the category:')
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
    
    let categoryId = null, ticketType = null;
    if (interaction.customId === 'general_ticket') { categoryId = CONFIG.GENERAL_CATEGORY_ID; ticketType = 'General Question'; }
    else if (interaction.customId === 'purchase_ticket') { categoryId = CONFIG.PURCHASE_CATEGORY_ID; ticketType = 'Purchase'; }
    else if (interaction.customId === 'buysupport_ticket') { categoryId = CONFIG.BUY_SUPPORT_CATEGORY_ID; ticketType = 'Buy Support'; }
    
    if (categoryId && ticketType) {
        for (const [channelId, data] of tickets.entries()) {
            if (data.userId === interaction.user.id) {
                const existing = interaction.guild.channels.cache.get(channelId);
                if (existing) {
                    return interaction.reply({ content: `❌ You already have a ticket: ${existing.toString()}`, ephemeral: true });
                }
            }
        }
        
        await interaction.reply({ content: `🎫 Creating ${ticketType} ticket...`, ephemeral: true });
        const channel = await createTicketChannel(interaction.user, interaction, categoryId, ticketType);
        await interaction.editReply({ content: `✅ Ticket created: ${channel.toString()}` });
    }
});

client.login(CONFIG.TOKEN);
