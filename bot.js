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
    CLEAR_ROLE_ID: process.env.CLEAR_ROLE_ID,  // NEW: Role for /clear command
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
            description: 'Create a beautiful product embed',
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
                    description: 'The product price (e.g., $19.99 or 20 EUR)',
                    type: 3,
                    required: true
                },
                {
                    name: 'description',
                    description: 'Optional product description',
                    type: 3,
                    required: false
                },
                {
                    name: 'image',
                    description: 'Optional image URL for the product',
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
        }
    ];
    
    await guild.commands.set(commands);
    console.log('✅ Slash commands /send, /product, and /clear registered!');
}

// ============================================
// DELETE ALL OLD SLASH COMMANDS
// ============================================
async function deleteAllSlashCommands(guild) {
    try {
        const commands = await guild.commands.fetch();
        for (const command of commands.values()) {
            if (command.name !== 'send' && command.name !== 'product' && command.name !== 'clear') {
                await guild.commands.delete(command.id);
                console.log(`🗑️ Deleted slash command: /${command.name}`);
            }
        }
        console.log('✅ Old slash commands removed!');
    } catch (error) {
        console.log('❌ Error deleting slash commands:', error.message);
    }
}

// ============================================
// CREATE TICKET CHANNEL DIRECTLY
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
// TICKET HELPER FUNCTIONS
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
        .setDescription(`Welcome ${user.toString()}! Your ticket has been created.\n\n**Ticket Type:** ${ticketType}\n**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n\nSupport team will assist you shortly. Use the buttons below to manage this ticket.`)
        .setColor(0x00ff00)
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: '📌 Instructions', value: '• Click **Claim Ticket** to take ownership\n• Click **Close Ticket** to delete this ticket\n• Click **Get Transcript** to save the conversation', inline: false },
            { name: '👤 User', value: user.toString(), inline: true },
            { name: '🆔 Ticket ID', value: channel.id, inline: true }
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
    console.log('📌 Use /send <message> - Send a message as the bot');
    console.log('📌 Use /product <name> <instock> <price> - Create a product embed');
    console.log('📌 Use /clear <amount> - Clear messages (requires CLEAR_ROLE_ID)');
});

// ============================================
// /SEND SLASH COMMAND
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'send') {
        if (!interaction.member.roles.cache.has(CONFIG.SEND_ROLE_ID)) {
            return interaction.reply({ 
                content: '❌ You do not have permission to use `/send`.', 
                ephemeral: true 
            });
        }
        
        const messageContent = interaction.options.getString('message');
        
        if (!messageContent || messageContent.trim() === '') {
            return interaction.reply({ 
                content: '❌ Please provide a message to send.', 
                ephemeral: true 
            });
        }
        
        await interaction.channel.send(messageContent);
        
        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply();
        
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📝 /send Command Used')
                .setDescription(`**User:** ${interaction.user.tag}\n**Channel:** ${interaction.channel.name}\n**Message:** ${messageContent.substring(0, 500)}`)
                .setColor(0xffaa00)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
    
    // ============================================
    // /PRODUCT SLASH COMMAND - NO AUTHOR NAME
    // ============================================
    if (interaction.commandName === 'product') {
        if (!interaction.member.roles.cache.has(CONFIG.PRODUCT_ROLE_ID)) {
            return interaction.reply({ 
                content: '❌ You do not have permission to use `/product`.', 
                ephemeral: true 
            });
        }
        
        const productName = interaction.options.getString('name');
        const instockRaw = interaction.options.getString('instock');
        const price = interaction.options.getString('price');
        const description = interaction.options.getString('description') || 'No description provided';
        const imageUrl = interaction.options.getString('image');
        
        // Store product info for the button handler
        const productInfo = { name: productName, price: price };
        
        // Check if in stock
        const inStock = instockRaw.toLowerCase() === 'yes';
        
        // Create stock status text
        const stockStatus = inStock ? '✅ **IN STOCK**' : '❌ **OUT OF STOCK**';
        const stockColor = inStock ? 0x00ff00 : 0xff0000;
        
        // Create clean product embed (NO author, NO footer with user name)
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
        
        // Add product image if provided
        if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            productEmbed.setImage(imageUrl);
        }
        
        productEmbed.setThumbnail('https://cdn-icons-png.flaticon.com/512/2331/2331970.png');
        
        // Generate unique button ID
        const buttonId = `buy_now_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        // Add action buttons
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
        
        // Store product data temporarily
        if (!client.productData) client.productData = new Map();
        client.productData.set(buttonId, { name: productName, price: price });
        
        await interaction.reply({ embeds: [productEmbed], components: [row] });
        
        // Log to log channel only
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📝 /product Command Used')
                .setDescription(`**User:** ${interaction.user.tag}\n**Product:** ${productName}\n**Stock:** ${instockRaw}\n**Price:** ${price}`)
                .setColor(0xffaa00)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
    
    // ============================================
    // /CLEAR SLASH COMMAND
    // ============================================
    if (interaction.commandName === 'clear') {
        if (!interaction.member.roles.cache.has(CONFIG.CLEAR_ROLE_ID)) {
            return interaction.reply({ 
                content: '❌ You do not have permission to use `/clear`.', 
                ephemeral: true 
            });
        }
        
        const amount = interaction.options.getInteger('amount');
        
        if (amount < 1 || amount > 100) {
            return interaction.reply({ 
                content: '❌ Please provide a number between 1 and 100.', 
                ephemeral: true 
            });
        }
        
        // Defer reply to avoid timeout
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            
            if (messages.size === 0) {
                return interaction.editReply({ content: '❌ No messages to clear.' });
            }
            
            // Delete messages
            await interaction.channel.bulkDelete(messages, true);
            
            await interaction.editReply({ 
                content: `✅ Successfully cleared ${messages.size} message(s).`,
                ephemeral: true
            });
            
            // Log to log channel
            const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📝 /clear Command Used')
                    .setDescription(`**User:** ${interaction.user.tag}\n**Channel:** ${interaction.channel.name}\n**Amount:** ${amount} messages cleared`)
                    .setColor(0xffaa00)
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        } catch (error) {
            console.error('Clear error:', error);
            await interaction.editReply({ 
                content: '❌ Failed to clear messages. Messages may be older than 14 days.', 
                ephemeral: true 
            });
        }
    }
});

// ============================================
// PRODUCT BUTTON HANDLERS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // BUY NOW button - creates ticket DIRECTLY
    if (interaction.customId.startsWith('buy_now_')) {
        // Get product info
        const productData = client.productData?.get(interaction.customId);
        const productName = productData?.name || 'Unknown Product';
        const productPrice = productData?.price || 'Unknown Price';
        
        // Check if user already has open ticket
        let existingTicket = null;
        for (const [channelId, data] of tickets.entries()) {
            if (data.userId === interaction.user.id) {
                existingTicket = interaction.guild.channels.cache.get(channelId);
                break;
            }
        }
        
        if (existingTicket) {
            return interaction.reply({ 
                content: `❌ You already have an open ticket: ${existingTicket.toString()}! Please close that one first.`, 
                ephemeral: true 
            });
        }
        
        await interaction.reply({ content: `🛒 Creating your purchase ticket for **${productName}**...`, ephemeral: true });
        
        // Create ticket directly
        const channel = await createDirectTicket(interaction.user, interaction, productName, productPrice);
        
        await interaction.editReply({ content: `✅ Purchase ticket created: ${channel.toString()}! A support member will assist you shortly.`, ephemeral: true });
        
        // Clean up stored product data
        if (client.productData) client.productData.delete(interaction.customId);
    }
    
    // MORE INFO button
    if (interaction.customId === 'more_info') {
        const embed = new EmbedBuilder()
            .setTitle('❓ Product Information')
            .setDescription(`For more information about this product, please click the **Buy Now** button to create a ticket and our team will assist you.`)
            .setColor(0x0099ff)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ============================================
// WELCOME DM FOR NEW MEMBERS
// ============================================
client.on('guildMemberAdd', async (member) => {
    await updateMemberCount(member.guild);
    
    if (joinedMembers.has(member.id)) return;
    
    try {
        const unverifiedRole = member.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
        if (unverifiedRole) await member.roles.add(unverifiedRole);
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Welcome to the Server!')
            .setDescription(`Hello ${member.user.username}! Welcome to our community.\n\nPlease verify yourself in <#${CONFIG.VERIFICATION_CHANNEL_ID}> to access all channels.`)
            .setColor(0x00ff00)
            .addFields(
                { name: '📌 Need Help?', value: 'Use the **Ticket System** to create a support ticket.', inline: true },
                { name: '✅ Verify', value: 'Go to the verification channel and click the button!', inline: true },
                { name: '⏱️ Time Limit', value: 'You have 24 hours to verify before being kicked.', inline: true }
            )
            .setThumbnail(member.guild.iconURL())
            .setFooter({ text: 'Please verify to access the server', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        await member.send({ embeds: [welcomeEmbed] });
        joinedMembers.add(member.id);
        console.log(`📨 Sent welcome DM to ${member.user.tag}`);
        
        setTimeout(async () => {
            const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
            if (freshMember && !freshMember.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
                await freshMember.kick('Did not verify within 24 hours').catch(() => {});
                console.log(`⏰ Kicked ${member.user.tag} for not verifying within 24 hours`);
                await updateMemberCount(member.guild);
            }
        }, 24 * 60 * 60 * 1000);
        
    } catch (error) {
        console.log(`Couldn't send welcome DM to ${member.user.tag}: ${error.message}`);
    }
});

// ============================================
// UPDATE MEMBER COUNT WHEN SOMEONE LEAVES
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
    
    if (!verifiedRole) return interaction.reply({ content: '❌ Verification role not configured!', ephemeral: true });
    if (interaction.member.roles.cache.has(verifiedRole.id)) return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
    
    await interaction.member.roles.add(verifiedRole);
    if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
    
    const verifyEmbed = new EmbedBuilder()
        .setTitle('✅ Verification Successful!')
        .setDescription(`Welcome ${interaction.user.toString()}! You have been verified and now have access to all channels.`)
        .setColor(0x00ff00)
        .setTimestamp();
    
    await interaction.reply({ embeds: [verifyEmbed], ephemeral: true });
    
    const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (logChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle('✅ User Verified')
            .setDescription(`**User:** ${interaction.user.tag}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
            .setColor(0x00ff00)
            .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
    }
    
    console.log(`✅ Verified ${interaction.user.tag}`);
});

// ============================================
// TICKET BUTTON HANDLERS (Claim, Close, Transcript)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Skip product buttons
    if (interaction.customId.startsWith('buy_now_') || interaction.customId === 'more_info') return;
    if (interaction.customId === 'create_ticket_menu') return;
    if (interaction.customId === 'general_ticket' || interaction.customId === 'purchase_ticket' || interaction.customId === 'buysupport_ticket') return;
    
    const ticketData = tickets.get(interaction.channelId);
    if (!ticketData) return;
    
    if (interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID)) {
            return interaction.reply({ content: '❌ You do not have permission to claim tickets!', ephemeral: true });
        }
        if (ticketData.claimedBy) {
            return interaction.reply({ content: '❌ This ticket has already been claimed!', ephemeral: true });
        }
        
        ticketData.claimedBy = interaction.user.id;
        tickets.set(interaction.channelId, ticketData);
        
        const embed = new EmbedBuilder()
            .setTitle('🎯 Ticket Claimed')
            .setDescription(`${interaction.user.toString()} has claimed this ticket and will assist you.`)
            .setColor(0xffaa00)
            .addFields(
                { name: 'Claimed by', value: interaction.user.tag, inline: true },
                { name: 'Ticket Type', value: ticketData.ticketType, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        const user = await interaction.guild.members.fetch(ticketData.userId).catch(() => null);
        if (user) {
            const claimEmbed = new EmbedBuilder()
                .setTitle('✅ Your Ticket Has Been Claimed')
                .setDescription(`Your **${ticketData.ticketType}** ticket in ${interaction.guild.name} has been claimed by **${interaction.user.tag}**!`)
                .setColor(0x00ff00)
                .addFields(
                    { name: 'Support Staff', value: interaction.user.tag, inline: true },
                    { name: 'Ticket Channel', value: `<#${interaction.channel.id}>`, inline: true }
                )
                .setTimestamp();
            
            await user.send({ embeds: [claimEmbed] }).catch(() => console.log('Could not DM user'));
        }
    }
    
    if (interaction.customId === 'close_ticket') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticketData.userId === interaction.user.id;
        if (!hasPerm) {
            return interaction.reply({ content: '❌ You do not have permission to close this ticket!', ephemeral: true });
        }
        
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Closing Ticket')
            .setDescription(`This ticket will be deleted in **5 seconds**. A transcript will be saved.`)
            .setColor(0xff0000)
            .setTimestamp();
        
        await interaction.reply({ embeds: [closeEmbed] });
        
        setTimeout(async () => {
            await sendTranscript(interaction.channel, interaction);
            await interaction.channel.delete();
            tickets.delete(interaction.channelId);
        }, 5000);
    }
    
    if (interaction.customId === 'transcript') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticketData.userId === interaction.user.id;
        if (!hasPerm) {
            return interaction.reply({ content: '❌ You do not have permission to get transcript!', ephemeral: true });
        }
        
        await interaction.reply({ content: '📄 Generating transcript...', ephemeral: true });
        await sendTranscript(interaction.channel, interaction);
        await interaction.editReply({ content: '✅ Transcript has been sent to the transcript channel!', ephemeral: true });
    }
});

// ============================================
// REGULAR TICKET CREATION BUTTONS (from support channel)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'create_ticket_menu') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Create a Support Ticket')
            .setDescription('Please select the category that best fits your needs:')
            .setColor(0x00ff00)
            .addFields(
                { name: '📋 General Question', value: 'General inquiries, questions, or feedback', inline: false },
                { name: '💰 Purchase', value: 'Payment issues, transaction problems, or billing', inline: false },
                { name: '🛡️ Buy Support', value: 'Premium support for paid services', inline: false }
            )
            .setFooter({ text: 'Choose carefully - this cannot be changed' })
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
                    return interaction.reply({ 
                        content: `❌ You already have an open ticket: ${existing.toString()}! Please close that one first.`, 
                        ephemeral: true 
                    });
                }
            }
        }
        
        await interaction.reply({ content: `🎫 Creating your ${ticketType} ticket...`, ephemeral: true });
        const channel = await createTicketChannel(interaction.user, interaction, categoryId, ticketType);
        await interaction.editReply({ content: `✅ ${ticketType} ticket created: ${channel.toString()}`, ephemeral: true });
    }
});

client.login(CONFIG.TOKEN);
