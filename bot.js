const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');

// ============================================
// CONFIG - ENVIRONMENT VARIABLES
// ============================================
const CONFIG = {
    // Ticket Categories
    GENERAL_CATEGORY_ID: process.env.GENERAL_CATEGORY_ID,
    PURCHASE_CATEGORY_ID: process.env.PURCHASE_CATEGORY_ID,
    BUY_SUPPORT_CATEGORY_ID: process.env.BUY_SUPPORT_CATEGORY_ID,
    
    // Roles
    SUPPORT_ROLE_ID: process.env.SUPPORT_ROLE_ID || '1509663687449903134',
    SEND_ROLE_ID: process.env.SEND_ROLE_ID,
    PRODUCT_ROLE_ID: process.env.PRODUCT_ROLE_ID,
    CLEAR_ROLE_ID: process.env.CLEAR_ROLE_ID,
    REVIEW_ROLE_ID: process.env.REVIEW_ROLE_ID,
    VERIFIED_ROLE_ID: process.env.VERIFIED_ROLE_ID,
    UNVERIFIED_ROLE_ID: process.env.UNVERIFIED_ROLE_ID,
    
    // Role Claim Roles
    SPOOF_ACCOUNTS_ROLE_ID: process.env.SPOOF_ACCOUNTS_ROLE_ID,
    TRIGGER_SHOP_ROLE_ID: process.env.TRIGGER_SHOP_ROLE_ID,
    SCRIPTS_ROLE_ID: process.env.SCRIPTS_ROLE_ID,
    CHEATS_SOFTWARE_ROLE_ID: process.env.CHEATS_SOFTWARE_ROLE_ID,
    IRL_TRADING_ROLE_ID: process.env.IRL_TRADING_ROLE_ID,
    
    // Channels
    REVIEW_CHANNEL_ID: process.env.REVIEW_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID: process.env.TRANSCRIPT_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    TICKET_CREATION_CHANNEL_ID: process.env.TICKET_CREATION_CHANNEL_ID,
    ROLE_CLAIM_CHANNEL_ID: process.env.ROLE_CLAIM_CHANNEL_ID,
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
// UPDATE MEMBER COUNT
// ============================================
async function updateMemberCount(guild) {
    try {
        await guild.members.fetch();
        const humanMembers = guild.members.cache.filter(member => !member.user.bot);
        const memberCount = humanMembers.size;
        client.user.setPresence({ activities: [{ name: `${memberCount} Members`, type: 3 }], status: 'online' });
        console.log(`✅ Member count: ${memberCount}`);
        return memberCount;
    } catch (error) {
        return 0;
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
            options: [{ name: 'message', description: 'The message to send', type: 3, required: true }]
        },
        {
            name: 'product',
            description: 'Create a product embed',
            options: [
                { name: 'name', description: 'Product name', type: 3, required: true },
                { name: 'instock', description: 'In stock?', type: 3, required: true, choices: [{ name: 'Yes ✅', value: 'yes' }, { name: 'No ❌', value: 'no' }] },
                { name: 'price', description: 'Product price', type: 3, required: true },
                { name: 'description', description: 'Product description', type: 3, required: false },
                { name: 'image', description: 'Image URL', type: 3, required: false }
            ]
        },
        {
            name: 'clear',
            description: 'Clear messages',
            options: [{ name: 'amount', description: 'Number to clear (1-100)', type: 4, required: true }]
        },
        {
            name: 'review',
            description: 'Leave a review',
            options: [
                { name: 'stars', description: 'Stars (1-5)', type: 4, required: true, choices: [
                    { name: '⭐ 1 star', value: 1 }, { name: '⭐⭐ 2 stars', value: 2 },
                    { name: '⭐⭐⭐ 3 stars', value: 3 }, { name: '⭐⭐⭐⭐ 4 stars', value: 4 },
                    { name: '⭐⭐⭐⭐⭐ 5 stars', value: 5 }
                ] },
                { name: 'product', description: 'Product name', type: 3, required: true },
                { name: 'review', description: 'Your review', type: 3, required: true }
            ]
        }
    ];
    await guild.commands.set(commands);
    console.log('✅ Commands registered!');
}

// ============================================
// DELETE OLD COMMANDS
// ============================================
async function deleteOldCommands(guild) {
    try {
        const commands = await guild.commands.fetch();
        for (const command of commands.values()) {
            if (!['send', 'product', 'clear', 'review'].includes(command.name)) {
                await guild.commands.delete(command.id);
            }
        }
    } catch (error) {}
}

// ============================================
// BEAUTIFUL ROLE CLAIM EMBED
// ============================================
async function sendRoleClaimMessage(guild) {
    const channel = guild.channels.cache.get(CONFIG.ROLE_CLAIM_CHANNEL_ID);
    if (!channel) return;
    
    await channel.bulkDelete(await channel.messages.fetch()).catch(() => {});
    
    const embed = new EmbedBuilder()
        .setTitle('🌟 **CLAIM YOUR ROLES** 🌟')
        .setDescription('> *Click any button below to get access to specific content!*\n> *You can claim multiple roles at once.*')
        .setColor(0x5865F2)
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '⬇️ **AVAILABLE ROLES** ⬇️', inline: false },
            { name: '🎭 **Spoof Accounts**', value: 'Access to spoof account resources', inline: true },
            { name: '🛒 **Trigger Shop**', value: 'Access to trigger shop content', inline: true },
            { name: '📜 **Scripts**', value: 'Access to script sharing', inline: true },
            { name: '💻 **Cheats/Software**', value: 'Access to cheats & software', inline: true },
            { name: '🔄 **IRL-Trading**', value: 'Access to IRL trading', inline: true }
        )
        .setFooter({ text: '✦ Click to toggle roles on/off ✦', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_spoof').setLabel('Spoof Accounts').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId('claim_trigger').setLabel('Trigger Shop').setStyle(ButtonStyle.Success).setEmoji('🛒'),
        new ButtonBuilder().setCustomId('claim_scripts').setLabel('Scripts').setStyle(ButtonStyle.Primary).setEmoji('📜')
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_cheats').setLabel('Cheats/Software').setStyle(ButtonStyle.Danger).setEmoji('💻'),
        new ButtonBuilder().setCustomId('claim_irl').setLabel('IRL-Trading').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_all').setLabel('Claim All Roles').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId('unclaim_all').setLabel('Remove All Roles').setStyle(ButtonStyle.Danger).setEmoji('❌')
    );
    
    await channel.send({ embeds: [embed], components: [row1, row2, row3] });
    console.log('✅ Role claim embed sent!');
}

// ============================================
// VERIFICATION SYSTEM
// ============================================
async function sendVerificationMessage(guild) {
    const channel = guild.channels.cache.get(CONFIG.VERIFICATION_CHANNEL_ID);
    if (!channel) return;
    
    await channel.bulkDelete(await channel.messages.fetch()).catch(() => {});
    
    const embed = new EmbedBuilder()
        .setTitle('✅ **VERIFICATION REQUIRED**')
        .setDescription('Welcome to the server! Please verify yourself to access all channels.\n\n*Click the button below to get started.*')
        .setColor(0x00ff00)
        .addFields(
            { name: '📋 Why verify?', value: 'Keeps the server safe from bots and spam.', inline: false },
            { name: '⚠️ Time Limit', value: 'You have 24 hours to verify before being kicked.', inline: true }
        )
        .setThumbnail(guild.iconURL())
        .setFooter({ text: 'Click to verify', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify_button').setLabel('Verify Me').setStyle(ButtonStyle.Success).setEmoji('✅')
    );
    await channel.send({ embeds: [embed], components: [row] });
    console.log('✅ Verification embed sent!');
}

// ============================================
// TICKET CREATION
// ============================================
async function createTicket(user, interaction, categoryId, type) {
    const guild = interaction.guild;
    const supportRole = guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
    const prefix = type === 'General Question' ? 'general' : (type === 'Purchase' ? 'purchase' : 'buysupport');
    
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
    
    tickets.set(channel.id, { userId: user.id, claimedBy: null, createdAt: Date.now(), type: type });
    
    const embed = new EmbedBuilder()
        .setTitle(`🎫 ${type} Ticket`)
        .setDescription(`Welcome ${user}! Your ticket has been created.\n\n**Type:** ${type}\n**Created:** <t:${Math.floor(Date.now() / 1000)}:F>`)
        .setColor(0x00ff00)
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: '📌 Instructions', value: '• **Claim Ticket** - Take ownership\n• **Close Ticket** - Delete ticket\n• **Get Transcript** - Save chat log', inline: false },
            { name: '👤 User', value: user.toString(), inline: true }
        )
        .setFooter({ text: `Ticket System`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('transcript').setLabel('Get Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄')
    );
    
    await channel.send({ content: `${user} ${supportRole}`, embeds: [embed], components: [row] });
    return channel;
}

async function createPurchaseTicket(user, interaction, productName, price) {
    const guild = interaction.guild;
    const supportRole = guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
    
    const channel = await guild.channels.create({
        name: `purchase-${user.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: CONFIG.PURCHASE_CATEGORY_ID,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ]
    });
    
    tickets.set(channel.id, { userId: user.id, claimedBy: null, createdAt: Date.now(), type: 'Purchase' });
    
    const embed = new EmbedBuilder()
        .setTitle(`🛒 Purchase Ticket`)
        .setDescription(`Welcome ${user}! Your purchase ticket has been created.\n\n**Product:** ${productName}\n**Price:** ${price}\n**Created:** <t:${Math.floor(Date.now() / 1000)}:F>`)
        .setColor(0x00ff00)
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: '📌 Instructions', value: '• **Claim Ticket** - Take ownership\n• **Close Ticket** - Delete ticket\n• **Get Transcript** - Save chat log', inline: false },
            { name: '👤 User', value: user.toString(), inline: true },
            { name: '🛒 Product', value: productName, inline: true },
            { name: '💰 Price', value: price, inline: true }
        )
        .setFooter({ text: `Purchase System`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('transcript').setLabel('Get Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄')
    );
    
    await channel.send({ content: `${user} ${supportRole}`, embeds: [embed], components: [row] });
    return channel;
}

async function sendTranscript(channel, interaction) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const data = tickets.get(channel.id);
    let transcript = `Ticket Transcript: ${channel.name}\nType: ${data?.type || 'Unknown'}\nCreated: ${new Date(data?.createdAt || Date.now()).toLocaleString()}\nClosed: ${new Date().toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    messages.reverse().forEach(msg => { transcript += `[${msg.author.tag}] (${msg.createdAt.toLocaleString()}): ${msg.content || '(embed)'}\n`; });
    
    const transcriptChannel = interaction.guild.channels.cache.get(CONFIG.TRANSCRIPT_CHANNEL_ID);
    if (transcriptChannel) {
        const embed = new EmbedBuilder()
            .setTitle('📝 Ticket Transcript')
            .setDescription(`Transcript for ${channel.name}\n**Type:** ${data?.type || 'Unknown'}`)
            .setColor(0x00aaff)
            .addFields(
                { name: 'User', value: `<@${data.userId}>`, inline: true },
                { name: 'Created', value: `<t:${Math.floor(data.createdAt / 1000)}:F>`, inline: true }
            )
            .setTimestamp();
        await transcriptChannel.send({ embeds: [embed], files: [{ attachment: Buffer.from(transcript, 'utf-8'), name: `${channel.name}-transcript.txt` }] });
    }
}

// ============================================
// READY EVENT
// ============================================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.first();
    
    if (guild) {
        await updateMemberCount(guild);
        setInterval(async () => { await updateMemberCount(guild); }, 300000);
        await deleteOldCommands(guild);
        await registerCommands(guild);
        await sendVerificationMessage(guild);
        await sendRoleClaimMessage(guild);
        
        // Ticket Channel Setup
        const ticketChannel = guild.channels.cache.get(CONFIG.TICKET_CREATION_CHANNEL_ID);
        if (ticketChannel) {
            await ticketChannel.bulkDelete(await ticketChannel.messages.fetch()).catch(() => {});
            const embed = new EmbedBuilder()
                .setTitle('🎫 **SUPPORT TICKET SYSTEM**')
                .setDescription('Need help? Click the button below to create a support ticket.')
                .setColor(0x00ff00)
                .addFields(
                    { name: '📋 How it works', value: '1. Click "Create Ticket"\n2. Choose your category\n3. A private channel will be created\n4. Support will assist you', inline: false },
                    { name: '⏱️ Response Time', value: 'Usually within 24 hours', inline: true }
                )
                .setThumbnail(guild.iconURL())
                .setFooter({ text: 'Support System', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('create_ticket_menu').setLabel('Create Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫')
            );
            await ticketChannel.send({ embeds: [embed], components: [row] });
        }
    }
    console.log('✅ Bot is fully ready!');
});

// ============================================
// SLASH COMMANDS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    // /send command
    if (interaction.commandName === 'send') {
        if (!interaction.member.roles.cache.has(CONFIG.SEND_ROLE_ID)) {
            await interaction.reply({ content: '❌ No permission.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        const msg = interaction.options.getString('message');
        if (!msg?.trim()) {
            await interaction.reply({ content: '❌ Provide a message.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        await interaction.channel.send(msg);
        await interaction.reply({ content: '✅ Sent!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 1000);
    }
    
    // /product command
    if (interaction.commandName === 'product') {
        if (!interaction.member.roles.cache.has(CONFIG.PRODUCT_ROLE_ID)) {
            await interaction.reply({ content: '❌ No permission.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        const name = interaction.options.getString('name');
        const inStock = interaction.options.getString('instock') === 'yes';
        const price = interaction.options.getString('price');
        const desc = interaction.options.getString('description') || 'No description';
        const img = interaction.options.getString('image');
        
        const embed = new EmbedBuilder()
            .setTitle(name)
            .setDescription(desc)
            .setColor(inStock ? 0x00ff00 : 0xff0000)
            .addFields(
                { name: '💰 Price', value: price, inline: true },
                { name: '📦 Stock', value: inStock ? '✅ IN STOCK' : '❌ OUT OF STOCK', inline: true },
                { name: '📅 Listed', value: new Date().toLocaleDateString(), inline: true },
                { name: '🛒 Purchase', value: 'Click **Buy Now** below!', inline: false }
            )
            .setTimestamp();
        if (img?.startsWith('http')) embed.setImage(img);
        embed.setThumbnail('https://cdn-icons-png.flaticon.com/512/2331/2331970.png');
        
        const btnId = `buy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(btnId).setLabel('Buy Now').setStyle(ButtonStyle.Success).setEmoji('🛒'),
            new ButtonBuilder().setCustomId('more_info').setLabel('More Info').setStyle(ButtonStyle.Primary).setEmoji('❓')
        );
        
        if (!client.products) client.products = new Map();
        client.products.set(btnId, { name, price });
        
        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Product posted!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 1000);
    }
    
    // /clear command
    if (interaction.commandName === 'clear') {
        if (!interaction.member.roles.cache.has(CONFIG.CLEAR_ROLE_ID)) {
            await interaction.reply({ content: '❌ No permission.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        const amount = interaction.options.getInteger('amount');
        if (amount < 1 || amount > 100) {
            await interaction.reply({ content: '❌ 1-100 only.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
            return;
        }
        await interaction.deferReply({ flags: 64 });
        try {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            if (messages.size === 0) {
                await interaction.editReply({ content: '❌ No messages.' });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
                return;
            }
            await interaction.channel.bulkDelete(messages, true);
            await interaction.editReply({ content: `✅ Cleared ${messages.size} messages.` });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        } catch {
            await interaction.editReply({ content: '❌ Failed. Messages may be too old.' });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        }
    }
    
    // /review command
    if (interaction.commandName === 'review') {
        if (!interaction.member.roles.cache.has(CONFIG.REVIEW_ROLE_ID)) {
            await interaction.reply({ content: '❌ No permission.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        const stars = interaction.options.getInteger('stars');
        const product = interaction.options.getString('product');
        const reviewText = interaction.options.getString('review');
        const starsDisplay = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        const color = stars === 3 ? 0xffaa00 : (stars >= 4 ? 0x00ff00 : 0xff0000);
        
        const embed = new EmbedBuilder()
            .setTitle(`📝 Review for ${product}`)
            .setDescription(`"${reviewText}"`)
            .setColor(color)
            .addFields(
                { name: '⭐ Rating', value: `${starsDisplay} (${stars}/5)`, inline: true },
                { name: '🛒 Product', value: product, inline: true },
                { name: '👤 Reviewer', value: interaction.user.tag, inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();
        
        const reviewChannel = interaction.guild.channels.cache.get(CONFIG.REVIEW_CHANNEL_ID);
        if (!reviewChannel) {
            await interaction.reply({ content: '❌ Review channel not set!', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        await reviewChannel.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Review posted!`, flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }
});

// ============================================
// BUTTON HANDLERS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Role Claim Buttons
    const roleMap = {
        'claim_spoof': CONFIG.SPOOF_ACCOUNTS_ROLE_ID,
        'claim_trigger': CONFIG.TRIGGER_SHOP_ROLE_ID,
        'claim_scripts': CONFIG.SCRIPTS_ROLE_ID,
        'claim_cheats': CONFIG.CHEATS_SOFTWARE_ROLE_ID,
        'claim_irl': CONFIG.IRL_TRADING_ROLE_ID
    };
    
    if (roleMap[interaction.customId]) {
        const role = interaction.guild.roles.cache.get(roleMap[interaction.customId]);
        if (!role) return interaction.reply({ content: '❌ Role not configured!', flags: 64 });
        
        if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            await interaction.reply({ content: `✅ Removed **${role.name}**`, flags: 64 });
        } else {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `✅ Added **${role.name}**`, flags: 64 });
        }
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Claim All Roles
    if (interaction.customId === 'claim_all') {
        const roles = [CONFIG.SPOOF_ACCOUNTS_ROLE_ID, CONFIG.TRIGGER_SHOP_ROLE_ID, CONFIG.SCRIPTS_ROLE_ID, CONFIG.CHEATS_SOFTWARE_ROLE_ID, CONFIG.IRL_TRADING_ROLE_ID];
        let added = 0;
        for (const id of roles) {
            const role = interaction.guild.roles.cache.get(id);
            if (role && !interaction.member.roles.cache.has(role.id)) {
                await interaction.member.roles.add(role);
                added++;
            }
        }
        await interaction.reply({ content: `✅ Added ${added} role(s)!`, flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Unclaim All Roles
    if (interaction.customId === 'unclaim_all') {
        const roles = [CONFIG.SPOOF_ACCOUNTS_ROLE_ID, CONFIG.TRIGGER_SHOP_ROLE_ID, CONFIG.SCRIPTS_ROLE_ID, CONFIG.CHEATS_SOFTWARE_ROLE_ID, CONFIG.IRL_TRADING_ROLE_ID];
        let removed = 0;
        for (const id of roles) {
            const role = interaction.guild.roles.cache.get(id);
            if (role && interaction.member.roles.cache.has(role.id)) {
                await interaction.member.roles.remove(role);
                removed++;
            }
        }
        await interaction.reply({ content: `✅ Removed ${removed} role(s)!`, flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }
    
    // Buy Now Button
    if (interaction.customId.startsWith('buy_')) {
        const product = client.products?.get(interaction.customId);
        const name = product?.name || 'Unknown';
        const price = product?.price || 'Unknown';
        
        let hasTicket = false;
        for (const [, data] of tickets) {
            if (data.userId === interaction.user.id) {
                hasTicket = true;
                break;
            }
        }
        
        if (hasTicket) {
            await interaction.reply({ content: `❌ You already have an open ticket!`, flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
            return;
        }
        
        await interaction.reply({ content: `🛒 Creating ticket for ${name}...`, flags: 64 });
        const channel = await createPurchaseTicket(interaction.user, interaction, name, price);
        await interaction.editReply({ content: `✅ Ticket created: ${channel}` });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        client.products?.delete(interaction.customId);
    }
    
    // More Info Button
    if (interaction.customId === 'more_info') {
        const embed = new EmbedBuilder()
            .setTitle('❓ Product Info')
            .setDescription('Click **Buy Now** to create a ticket and our team will assist you.')
            .setColor(0x0099ff)
            .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
    }
    
    // Verification Button
    if (interaction.customId === 'verify_button') {
        const verified = interaction.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
        const unverified = interaction.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
        if (!verified) return interaction.reply({ content: '❌ Role not set!', flags: 64 });
        if (interaction.member.roles.cache.has(verified.id)) return interaction.reply({ content: '✅ Already verified!', flags: 64 });
        
        await interaction.member.roles.add(verified);
        if (unverified) await interaction.member.roles.remove(unverified);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Verified!')
            .setDescription(`Welcome ${interaction.user}! You now have access.`)
            .setColor(0x00ff00)
            .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Create Ticket Menu
    if (interaction.customId === 'create_ticket_menu') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Create Ticket')
            .setDescription('Select a category:')
            .setColor(0x00ff00)
            .addFields(
                { name: '📋 General Question', value: 'General inquiries', inline: false },
                { name: '💰 Purchase', value: 'Payment issues', inline: false },
                { name: '🛡️ Buy Support', value: 'Premium support', inline: false }
            )
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('general_ticket').setLabel('General Question').setStyle(ButtonStyle.Primary).setEmoji('📋'),
            new ButtonBuilder().setCustomId('purchase_ticket').setLabel('Purchase').setStyle(ButtonStyle.Success).setEmoji('💰'),
            new ButtonBuilder().setCustomId('buysupport_ticket').setLabel('Buy Support').setStyle(ButtonStyle.Danger).setEmoji('🛡️')
        );
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }
    
    // Ticket Type Selection
    let catId = null, type = null;
    if (interaction.customId === 'general_ticket') { catId = CONFIG.GENERAL_CATEGORY_ID; type = 'General Question'; }
    else if (interaction.customId === 'purchase_ticket') { catId = CONFIG.PURCHASE_CATEGORY_ID; type = 'Purchase'; }
    else if (interaction.customId === 'buysupport_ticket') { catId = CONFIG.BUY_SUPPORT_CATEGORY_ID; type = 'Buy Support'; }
    
    if (catId && type) {
        for (const [, data] of tickets) {
            if (data.userId === interaction.user.id) {
                return interaction.reply({ content: `❌ You already have a ticket!`, flags: 64 });
            }
        }
        await interaction.reply({ content: `🎫 Creating ${type} ticket...`, flags: 64 });
        const channel = await createTicket(interaction.user, interaction, catId, type);
        await interaction.editReply({ content: `✅ Ticket created: ${channel}` });
    }
    
    // Ticket Management
    const ticket = tickets.get(interaction.channelId);
    if (!ticket) return;
    
    if (interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID)) return interaction.reply({ content: '❌ No permission!', flags: 64 });
        if (ticket.claimedBy) return interaction.reply({ content: '❌ Already claimed!', flags: 64 });
        
        ticket.claimedBy = interaction.user.id;
        tickets.set(interaction.channelId, ticket);
        await interaction.reply({ content: `🎯 ${interaction.user.tag} claimed this ticket!` });
        const user = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
        if (user) user.send(`✅ Your ticket was claimed by ${interaction.user.tag}!`).catch(() => {});
    }
    
    if (interaction.customId === 'close_ticket') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticket.userId === interaction.user.id;
        if (!hasPerm) return interaction.reply({ content: '❌ No permission!', flags: 64 });
        await interaction.reply({ content: '🔒 Closing in 5 seconds...' });
        setTimeout(async () => {
            await sendTranscript(interaction.channel, interaction);
            await interaction.channel.delete();
            tickets.delete(interaction.channelId);
        }, 5000);
    }
    
    if (interaction.customId === 'transcript') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticket.userId === interaction.user.id;
        if (!hasPerm) return interaction.reply({ content: '❌ No permission!', flags: 64 });
        await interaction.reply({ content: '📄 Generating...', flags: 64 });
        await sendTranscript(interaction.channel, interaction);
        await interaction.editReply({ content: '✅ Transcript sent!' });
    }
});

// ============================================
// GUILD MEMBER EVENTS
// ============================================
client.on('guildMemberAdd', async (member) => {
    await updateMemberCount(member.guild);
    if (joinedMembers.has(member.id)) return;
    
    try {
        const unverified = member.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
        if (unverified) await member.roles.add(unverified);
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 Welcome to HexMods!')
            .setDescription(`Hello ${member.user.username}! Welcome!\n\nVerify in <#${CONFIG.VERIFICATION_CHANNEL_ID}> to access channels.`)
            .setColor(0x00ff00)
            .addFields(
                { name: '⏱️ Time Limit', value: '24 hours to verify', inline: true },
                { name: '📌 Help', value: 'Use the ticket system', inline: true }
            )
            .setThumbnail(member.guild.iconURL())
            .setTimestamp();
        
        await member.send({ embeds: [embed] });
        joinedMembers.add(member.id);
        
        setTimeout(async () => {
            const fresh = await member.guild.members.fetch(member.id).catch(() => null);
            if (fresh && !fresh.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
                await fresh.kick('Not verified in 24h').catch(() => {});
                await updateMemberCount(member.guild);
            }
        }, 24 * 60 * 60 * 1000);
    } catch (error) {}
});

client.on('guildMemberRemove', async (member) => {
    await updateMemberCount(member.guild);
});

client.login(CONFIG.TOKEN);
