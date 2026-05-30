const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ============================================
// DATA OPSLAG (PERSISTENT)
// ============================================
const DATA_FILE = path.join(__dirname, 'botdata.json');

// Data structuur
let botData = {
    storage: {
        discord: [],
        steam: [],
        fivem: []
    },
    purchases: [],
    tickets: []
};

// Laad opgeslagen data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            botData.storage = parsed.storage || { discord: [], steam: [], fivem: [] };
            botData.purchases = parsed.purchases || [];
            console.log('✅ Data geladen uit botdata.json');
        } else {
            console.log('📁 Geen bestaand data bestand, start met lege storage');
        }
    } catch (error) {
        console.log('❌ Fout bij laden data:', error.message);
    }
}

// Sla data op
function saveData() {
    try {
        const dataToSave = {
            storage: botData.storage,
            purchases: botData.purchases,
            lastSaved: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
        console.log('✅ Data opgeslagen in botdata.json');
    } catch (error) {
        console.log('❌ Fout bij opslaan data:', error.message);
    }
}

// Laad data bij opstart
loadData();

// ============================================
// CONFIG - ENVIRONMENT VARIABLES
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
    VERIFIED_ROLE_ID: process.env.VERIFIED_ROLE_ID,
    UNVERIFIED_ROLE_ID: process.env.UNVERIFIED_ROLE_ID,
    CREATE_PURCHASE_ROLE_ID: process.env.CREATE_PURCHASE_ROLE_ID,
    PURCHASE_ROLE_ID: process.env.PURCHASE_ROLE_ID,
    VERIFYALL_ROLE_ID: process.env.VERIFYALL_ROLE_ID,
    GIVEACCOUNT_ROLE_ID: process.env.GIVEACCOUNT_ROLE_ID,
    
    SPOOF_ACCOUNTS_ROLE_ID: process.env.SPOOF_ACCOUNTS_ROLE_ID,
    TRIGGER_SHOP_ROLE_ID: process.env.TRIGGER_SHOP_ROLE_ID,
    SCRIPTS_ROLE_ID: process.env.SCRIPTS_ROLE_ID,
    CHEATS_SOFTWARE_ROLE_ID: process.env.CHEATS_SOFTWARE_ROLE_ID,
    IRL_TRADING_ROLE_ID: process.env.IRL_TRADING_ROLE_ID,
    
    REVIEW_CHANNEL_ID: process.env.REVIEW_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID: process.env.TRANSCRIPT_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    TICKET_CREATION_CHANNEL_ID: process.env.TICKET_CREATION_CHANNEL_ID,
    ROLE_CLAIM_CHANNEL_ID: process.env.ROLE_CLAIM_CHANNEL_ID,
    VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID,
    
    STORAGE_DISCORD_CHANNEL_ID: process.env.STORAGE_DISCORD_CHANNEL_ID,
    STORAGE_STEAM_CHANNEL_ID: process.env.STORAGE_STEAM_CHANNEL_ID,
    STORAGE_FIVEM_CHANNEL_ID: process.env.STORAGE_FIVEM_CHANNEL_ID,
    
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

// Load saved purchases into memory
let purchases = new Map();
if (botData.purchases && botData.purchases.length > 0) {
    for (const p of botData.purchases) {
        purchases.set(p.name, p);
    }
    console.log(`✅ ${purchases.size} producten geladen uit opslag`);
}

// Load saved storage into memory
const storage = {
    discord: botData.storage.discord || [],
    steam: botData.storage.steam || [],
    fivem: botData.storage.fivem || []
};
console.log(`✅ Storage geladen: Discord: ${storage.discord.length}, Steam: ${storage.steam.length}, FiveM: ${storage.fivem.length}`);

let storageMessages = {
    discord: null,
    steam: null,
    fivem: null
};

// ============================================
// STORAGE FUNCTIONS (MET AUTO-SAVE)
// ============================================
function saveAllData() {
    botData.storage = storage;
    botData.purchases = Array.from(purchases.values());
    saveData();
}

function addAccount(type, accountData, addedBy) {
    const account = {
        id: Math.random().toString(36).substring(2, 10).toUpperCase(),
        content: accountData,
        addedBy: addedBy,
        addedAt: Date.now()
    };
    storage[type].push(account);
    saveAllData();
    updateAllStorageDisplays();
    return account;
}

function getAccountsByType(type) {
    return storage[type].map(account => ({ ...account, type: type }));
}

function removeAccountById(accountId, type) {
    const index = storage[type].findIndex(a => a.id === accountId);
    if (index !== -1) {
        const removed = storage[type][index];
        storage[type].splice(index, 1);
        saveAllData();
        updateAllStorageDisplays();
        return { ...removed, type: type };
    }
    return null;
}

function getStorageStats() {
    return {
        discord: storage.discord.length,
        steam: storage.steam.length,
        fivem: storage.fivem.length,
        total: storage.discord.length + storage.steam.length + storage.fivem.length
    };
}

function isBundleAvailable() {
    return storage.discord.length > 0 && storage.steam.length > 0 && storage.fivem.length > 0;
}

function giveBundle() {
    const getRandom = (type) => {
        if (storage[type].length === 0) return null;
        const randomIndex = Math.floor(Math.random() * storage[type].length);
        const account = storage[type][randomIndex];
        removeAccountById(account.id, type);
        return account;
    };
    
    const discordAccount = getRandom('discord');
    const steamAccount = getRandom('steam');
    const fivemAccount = getRandom('fivem');
    
    if (!discordAccount || !steamAccount || !fivemAccount) return null;
    
    return {
        discord: discordAccount,
        steam: steamAccount,
        fivem: fivemAccount
    };
}

// ============================================
// PURCHASE FUNCTIONS (MET AUTO-SAVE)
// ============================================
function addPurchase(name, content, createdBy, hasFile, fileUrl, fileName) {
    const purchase = {
        name: name.toLowerCase(),
        originalName: name,
        content: content,
        createdBy: createdBy,
        createdAt: Date.now(),
        hasFile: hasFile || false,
        fileUrl: fileUrl || null,
        fileName: fileName || null
    };
    purchases.set(name.toLowerCase(), purchase);
    saveAllData();
    return purchase;
}

function getPurchase(name) {
    return purchases.get(name.toLowerCase());
}

function getAllPurchases() {
    return Array.from(purchases.values());
}

function removePurchase(name) {
    const deleted = purchases.delete(name.toLowerCase());
    if (deleted) saveAllData();
    return deleted;
}

// ============================================
// UPDATE STORAGE DISPLAYS
// ============================================
async function updateStorageDisplayForType(type) {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    
    let channelId, title, emoji, color;
    
    switch(type) {
        case 'discord':
            channelId = CONFIG.STORAGE_DISCORD_CHANNEL_ID;
            title = '💬 **DISCORD ACCOUNTS STORAGE**';
            emoji = '💬';
            color = 0x5865F2;
            break;
        case 'steam':
            channelId = CONFIG.STORAGE_STEAM_CHANNEL_ID;
            title = '🎮 **STEAM ACCOUNTS STORAGE**';
            emoji = '🎮';
            color = 0x1b2838;
            break;
        case 'fivem':
            channelId = CONFIG.STORAGE_FIVEM_CHANNEL_ID;
            title = '🚗 **FIVEM ACCOUNTS STORAGE**';
            emoji = '🚗';
            color = 0x00ff00;
            break;
        default:
            return;
    }
    
    const storageChannel = guild.channels.cache.get(channelId);
    if (!storageChannel) {
        console.log(`❌ Storage channel for ${type} not configured!`);
        return;
    }
    
    const stats = getStorageStats();
    const accountList = storage[type].map(a => `\`${a.id}\` - ${a.content.substring(0, 80)}...`).join('\n') || '`Geen accounts beschikbaar`';
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`**Aantal accounts:** ${stats[type]}\n*Laatst bijgewerkt: <t:${Math.floor(Date.now() / 1000)}:R>*`)
        .setColor(color)
        .setThumbnail(LOGO_URL)
        .addFields(
            { name: `📋 **Accounts**`, value: accountList.length > 1000 ? accountList.substring(0, 997) + '...' : accountList, inline: false }
        )
        .setFooter({ text: `Accounts worden automatisch verwijderd na uitgifte` })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`refresh_${type}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`export_${type}`)
            .setLabel('📋 Exporteer')
            .setStyle(ButtonStyle.Primary)
    );
    
    try {
        if (storageMessages[type]) {
            const existingMessage = await storageChannel.messages.fetch(storageMessages[type]).catch(() => null);
            if (existingMessage) {
                await existingMessage.edit({ embeds: [embed], components: [row] });
                return;
            }
        }
        
        const newMessage = await storageChannel.send({ embeds: [embed], components: [row] });
        storageMessages[type] = newMessage.id;
    } catch (error) {
        console.log(`❌ Failed to update ${type} storage:`, error.message);
    }
}

async function updateAllStorageDisplays() {
    await updateStorageDisplayForType('discord');
    await updateStorageDisplayForType('steam');
    await updateStorageDisplayForType('fivem');
}

// ============================================
// LOGO URL
// ============================================
const LOGO_URL = 'https://cdn.discordapp.com/attachments/1509665549410635787/1509928894361370735/hexmods.png';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            description: 'Send a message as the bot (opens a modal for multi-line messages)',
            options: []
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
        },
        {
            name: 'createpurchase',
            description: 'Create a purchase option (admin only)',
            options: [
                { name: 'name', description: 'Product name', type: 3, required: true },
                { name: 'content', description: 'The text message to send (optional if file is attached)', type: 3, required: false },
                { name: 'file', description: 'File to attach (optional)', type: 11, required: false }
            ]
        },
        {
            name: 'purchase',
            description: 'Purchase a product for a user (admin only)',
            options: [
                { name: 'user', description: 'The user who bought the product', type: 6, required: true }
            ]
        },
        {
            name: 'verifyall',
            description: 'Verify ALL members (adds verified role, removes unverified)',
            options: []
        },
        {
            name: 'addaccount',
            description: 'Add an account to storage (admin only)',
            options: [
                { name: 'type', description: 'Account type', type: 3, required: true, choices: [
                    { name: 'Discord', value: 'discord' },
                    { name: 'Steam', value: 'steam' },
                    { name: 'FiveM', value: 'fivem' }
                ] },
                { name: 'account', description: 'The account login details', type: 3, required: true }
            ]
        },
        {
            name: 'giveaccount',
            description: 'Give an account to a user',
            options: [
                { name: 'user', description: 'The user to give the account to', type: 6, required: true }
            ]
        },
        {
            name: 'givebundle',
            description: 'Give a bundle (1 Discord, 1 Steam, 1 FiveM account)',
            options: [
                { name: 'user', description: 'The user to give the bundle to', type: 6, required: true }
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
            if (!['send', 'product', 'clear', 'review', 'createpurchase', 'purchase', 'verifyall', 'addaccount', 'giveaccount', 'givebundle'].includes(command.name)) {
                await guild.commands.delete(command.id);
            }
        }
    } catch (error) {}
}

// ============================================
// SUPPORT TICKET SYSTEM EMBED
// ============================================
async function sendTicketMessage(guild) {
    const channel = guild.channels.cache.get(CONFIG.TICKET_CREATION_CHANNEL_ID);
    if (!channel) return;
    
    await channel.bulkDelete(await channel.messages.fetch()).catch(() => {});
    
    const embed = new EmbedBuilder()
        .setTitle('🎫 **SUPPORT TICKET SYSTEM**')
        .setDescription('Need help? Click the button below to create a support ticket.')
        .setColor(0x5865F2)
        .setThumbnail(LOGO_URL)
        .addFields(
            { name: '📋 How it works', value: '1️⃣ Click **"Create Ticket"** below\n2️⃣ Choose your category\n3️⃣ A private channel will be created\n4️⃣ Support will assist you', inline: false },
            { name: '⏱️ Response Time', value: 'Usually within 24 hours', inline: true },
            { name: '📜 Guidelines', value: 'Be respectful and patient', inline: true }
        )
        .setFooter({ text: 'Support System', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_ticket_menu').setLabel('Create Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫')
    );
    await channel.send({ embeds: [embed], components: [row] });
    console.log('✅ Ticket system embed sent!');
}

// ============================================
// ROLE CLAIM EMBED
// ============================================
async function sendRoleClaimMessage(guild) {
    const channel = guild.channels.cache.get(CONFIG.ROLE_CLAIM_CHANNEL_ID);
    if (!channel) return;
    
    await channel.bulkDelete(await channel.messages.fetch()).catch(() => {});
    
    const embed = new EmbedBuilder()
        .setTitle('🌟 **CLAIM YOUR ROLES** 🌟')
        .setDescription('> *Click any button below to get access to specific content!*\n> *You can claim multiple roles at once.*')
        .setColor(0x5865F2)
        .setThumbnail(LOGO_URL)
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
        new ButtonBuilder().setCustomId('claim_spoof').setLabel('Spoof Accounts').setStyle(ButtonStyle.Secondary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId('claim_trigger').setLabel('Trigger Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛒'),
        new ButtonBuilder().setCustomId('claim_scripts').setLabel('Scripts').setStyle(ButtonStyle.Secondary).setEmoji('📜')
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_cheats').setLabel('Cheats/Software').setStyle(ButtonStyle.Secondary).setEmoji('💻'),
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
        .setThumbnail(LOGO_URL)
        .addFields(
            { name: '📋 Why verify?', value: 'Keeps the server safe from bots and spam.', inline: false },
            { name: '🔓 What happens after?', value: 'You will get access to all channels!', inline: true }
        )
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
        .setThumbnail(LOGO_URL)
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
        .setThumbnail(LOGO_URL)
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
// VERIFYALL COMMAND
// ============================================
async function verifyAllMembers(interaction) {
    const verifiedRole = interaction.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
    const unverifiedRole = interaction.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
    
    if (!verifiedRole) {
        return interaction.reply({ content: '❌ Verified role not configured!', flags: 64 });
    }
    
    await interaction.reply({ content: '🔄 **Verifying all members...** This may take a while.', flags: 64 });
    
    let verifiedCount = 0;
    let alreadyVerifiedCount = 0;
    let failedCount = 0;
    
    await interaction.guild.members.fetch();
    const members = interaction.guild.members.cache.filter(member => !member.user.bot);
    
    for (const member of members.values()) {
        try {
            if (!member.roles.cache.has(verifiedRole.id)) {
                await member.roles.add(verifiedRole);
                verifiedCount++;
            } else {
                alreadyVerifiedCount++;
            }
            
            if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
                await member.roles.remove(unverifiedRole);
            }
            
            await delay(500);
            
        } catch (error) {
            failedCount++;
            console.log(`Failed to verify ${member.user.tag}: ${error.message}`);
        }
    }
    
    const resultEmbed = new EmbedBuilder()
        .setTitle('✅ **Verification Complete!**')
        .setDescription(`All members have been processed.`)
        .setColor(0x00ff00)
        .setThumbnail(LOGO_URL)
        .addFields(
            { name: '✅ Newly Verified', value: `${verifiedCount} members`, inline: true },
            { name: '🔄 Already Verified', value: `${alreadyVerifiedCount} members`, inline: true },
            { name: '❌ Failed', value: `${failedCount} members`, inline: true },
            { name: '📊 Total Members', value: `${members.size} members`, inline: true }
        )
        .setFooter({ text: `Verified by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
    
    await interaction.editReply({ content: null, embeds: [resultEmbed] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
    
    const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (logChannel) {
        logChannel.send({ content: `📝 **/verifyall** executed by ${interaction.user.tag}\n**Result:** ${verifiedCount} verified, ${alreadyVerifiedCount} already verified, ${failedCount} failed` }).catch(() => {});
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
        await sendTicketMessage(guild);
        
        await updateAllStorageDisplays();
        
        setInterval(async () => {
            await updateAllStorageDisplays();
        }, 30000);
    }
    console.log('✅ Bot is fully ready!');
    console.log(`📦 Storage: Discord: ${storage.discord.length}, Steam: ${storage.steam.length}, FiveM: ${storage.fivem.length}`);
    console.log(`🛒 Products: ${purchases.size} producten beschikbaar`);
});

// ============================================
// SLASH COMMANDS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    // /send command
    if (interaction.commandName === 'send') {
        if (!interaction.member.roles.cache.has(CONFIG.SEND_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to use `/send`.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const modal = new ModalBuilder()
            .setCustomId('send_message_modal')
            .setTitle('Send Message as Bot')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('message_content')
                        .setLabel('Message Content')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Type your message here... (Shift+Enter for new line)')
                        .setRequired(true)
                        .setMaxLength(4000)
                )
            );
        
        await interaction.showModal(modal);
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
            .setThumbnail(LOGO_URL)
            .addFields(
                { name: '💰 Price', value: price, inline: true },
                { name: '📦 Stock', value: inStock ? '✅ IN STOCK' : '❌ OUT OF STOCK', inline: true },
                { name: '📅 Listed', value: new Date().toLocaleDateString(), inline: true }
            )
            .setTimestamp();
        if (img?.startsWith('http')) embed.setImage(img);
        
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
            .setThumbnail(LOGO_URL)
            .addFields(
                { name: '⭐ Rating', value: `${starsDisplay} (${stars}/5)`, inline: true },
                { name: '🛒 Product', value: product, inline: true },
                { name: '👤 Reviewer', value: interaction.user.tag, inline: true }
            )
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
    
    // /createpurchase command
    if (interaction.commandName === 'createpurchase') {
        if (!interaction.member.roles.cache.has(CONFIG.CREATE_PURCHASE_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to create purchases.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const name = interaction.options.getString('name');
        const content = interaction.options.getString('content');
        
        let attachmentUrl = null;
        let attachmentName = null;
        
        if (interaction.options.getAttachment('file')) {
            const attachment = interaction.options.getAttachment('file');
            attachmentUrl = attachment.url;
            attachmentName = attachment.name;
        }
        
        let finalContent = content || '';
        if (attachmentUrl) {
            if (finalContent) finalContent += '\n\n';
            finalContent += `📎 **File:** ${attachmentName}\n🔗 **Download:** ${attachmentUrl}`;
        }
        
        if (!finalContent || finalContent.trim() === '') {
            await interaction.reply({ content: '❌ Please provide either text content or a file.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        addPurchase(name, finalContent, interaction.user.tag, !!attachmentUrl, attachmentUrl, attachmentName);
        
        await interaction.reply({ content: `✅ Purchase option **${name}** has been created! Use /purchase to sell it.`, flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send({ content: `📝 **/createpurchase** by ${interaction.user.tag}\n**Product:** ${name}` }).catch(() => {});
        }
    }
    
    // /purchase command
    if (interaction.commandName === 'purchase') {
        if (!interaction.member.roles.cache.has(CONFIG.PURCHASE_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to purchase products.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const buyer = interaction.options.getUser('user');
        const allPurchases = getAllPurchases();
        
        if (allPurchases.length === 0) {
            await interaction.reply({ content: '❌ No products available for purchase yet.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`purchase_select_${buyer.id}_${interaction.channelId}`)
            .setPlaceholder('Select a product to purchase')
            .addOptions(
                allPurchases.map(product => {
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel(product.originalName.length > 100 ? product.originalName.substring(0, 97) + '...' : product.originalName)
                        .setDescription(`Created: ${new Date(product.createdAt).toLocaleDateString()}`)
                        .setValue(product.name)
                        .setEmoji('🛍️');
                    
                    if (product.originalName.length > 100) {
                        option.setLabel(product.originalName.substring(0, 97) + '...');
                    }
                    
                    return option;
                })
            );
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: `📦 **Select a product to purchase for ${buyer}**`,
            components: [row],
            flags: 64
        });
    }
    
    // /verifyall command
    if (interaction.commandName === 'verifyall') {
        if (!interaction.member.roles.cache.has(CONFIG.VERIFYALL_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to use /verifyall.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        await verifyAllMembers(interaction);
    }
    
    // /addaccount command
    if (interaction.commandName === 'addaccount') {
        if (!interaction.member.roles.cache.has(CONFIG.CREATE_PURCHASE_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to add accounts.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const type = interaction.options.getString('type');
        const accountData = interaction.options.getString('account');
        
        const account = addAccount(type, accountData, interaction.user.tag);
        
        const embed = new EmbedBuilder()
            .setTitle(`✅ Account Added to ${type.charAt(0).toUpperCase() + type.slice(1)} Storage`)
            .setDescription(`**Account ID:** \`${account.id}\`\n**Content:** ${accountData.substring(0, 500)}`)
            .setColor(0x00ff00)
            .setThumbnail(LOGO_URL)
            .addFields(
                { name: '📊 Storage Stats', value: `Discord: ${storage.discord.length} | Steam: ${storage.steam.length} | FiveM: ${storage.fivem.length}`, inline: false }
            )
            .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
        
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send({ content: `📝 **/addaccount** by ${interaction.user.tag}\n**Type:** ${type}\n**ID:** ${account.id}` }).catch(() => {});
        }
    }
    
    // /giveaccount command
    if (interaction.commandName === 'giveaccount') {
        if (!interaction.member.roles.cache.has(CONFIG.GIVEACCOUNT_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to give accounts.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const user = interaction.options.getUser('user');
        const totalAccounts = storage.discord.length + storage.steam.length + storage.fivem.length;
        
        if (totalAccounts === 0) {
            await interaction.reply({ content: '❌ No accounts available in storage!', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const categoryOptions = [];
        
        if (storage.discord.length > 0) {
            categoryOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('💬 Discord Accounts')
                    .setDescription(`${storage.discord.length} account(s) available`)
                    .setValue('discord')
                    .setEmoji('💬')
            );
        }
        
        if (storage.steam.length > 0) {
            categoryOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('🎮 Steam Accounts')
                    .setDescription(`${storage.steam.length} account(s) available`)
                    .setValue('steam')
                    .setEmoji('🎮')
            );
        }
        
        if (storage.fivem.length > 0) {
            categoryOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('🚗 FiveM Accounts')
                    .setDescription(`${storage.fivem.length} account(s) available`)
                    .setValue('fivem')
                    .setEmoji('🚗')
            );
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`giveaccount_category_${user.id}_${interaction.channelId}`)
            .setPlaceholder('Select a category...')
            .addOptions(categoryOptions);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: `📦 **Select a category to give an account to ${user}**`,
            components: [row],
            flags: 64
        });
    }
    
    // /givebundle command
    if (interaction.commandName === 'givebundle') {
        if (!interaction.member.roles.cache.has(CONFIG.GIVEACCOUNT_ROLE_ID)) {
            await interaction.reply({ content: '❌ You do not have permission to give bundles.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            return;
        }
        
        const user = interaction.options.getUser('user');
        
        if (!isBundleAvailable()) {
            await interaction.reply({ content: '❌ Bundle not available! Need at least 1 Discord, 1 Steam, and 1 FiveM account.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
            return;
        }
        
        const bundle = giveBundle();
        
        if (!bundle) {
            await interaction.reply({ content: '❌ Failed to create bundle. Please check storage.', flags: 64 });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
            return;
        }
        
        const bundleEmbed = new EmbedBuilder()
            .setTitle(`🎁 **Bundle Given to ${user.tag}**`)
            .setDescription(`**Bundle bestaat uit:**\n\n**Discord Account:**\n${bundle.discord.content}\n\n**Steam Account:**\n${bundle.steam.content}\n\n**FiveM Account:**\n${bundle.fivem.content}`)
            .setColor(0x00ff00)
            .setThumbnail(LOGO_URL)
            .addFields(
                { name: '📦 Bundle IDs', value: `Discord: \`${bundle.discord.id}\`\nSteam: \`${bundle.steam.id}\`\nFiveM: \`${bundle.fivem.id}\``, inline: true },
                { name: '👤 Gegeven door', value: interaction.user.tag, inline: true },
                { name: '📅 Gegeven op', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Bundle Delivery', iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();
        
        await interaction.channel.send({ embeds: [bundleEmbed] });
        
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle(`🎁 **Bundle Received!**`)
                .setDescription(`**Je hebt een bundle ontvangen met:**\n\n**Discord Account:**\n${bundle.discord.content}\n\n**Steam Account:**\n${bundle.steam.content}\n\n**FiveM Account:**\n${bundle.fivem.content}`)
                .setColor(0x00ff00)
                .setThumbnail(LOGO_URL)
                .addFields(
                    { name: '📅 Ontvangen op', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: '🔒 Note', value: 'Keep this message private. Do not share with others.', inline: true }
                )
                .setTimestamp();
            
            await user.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.log(`Could not DM ${user.tag}: ${error.message}`);
        }
        
        await interaction.reply({ content: `✅ **Bundle** has been given to ${user.tag}!`, flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            logChannel.send({ content: `📝 **/givebundle** by ${interaction.user.tag} for ${user.tag}\n**Bundle IDs:** ${bundle.discord.id}, ${bundle.steam.id}, ${bundle.fivem.id}` }).catch(() => {});
        }
    }
});

// ============================================
// GIVEACCOUNT CATEGORY SELECTION HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('giveaccount_category_')) return;
    
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    const channelId = parts[3];
    const category = interaction.values[0];
    
    const targetUser = await interaction.guild.members.fetch(userId).catch(() => null);
    const targetChannel = interaction.guild.channels.cache.get(channelId);
    
    if (!targetUser) {
        await interaction.reply({ content: '❌ User not found!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    if (!targetChannel) {
        await interaction.reply({ content: '❌ Channel not found!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    const accounts = getAccountsByType(category);
    
    if (accounts.length === 0) {
        await interaction.reply({ content: `❌ No ${category} accounts available!`, flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    const accountOptions = accounts.map(account => {
        let emoji = '💬';
        if (category === 'steam') emoji = '🎮';
        if (category === 'fivem') emoji = '🚗';
        
        let label = `${account.id}`;
        if (label.length > 100) label = label.substring(0, 97) + '...';
        
        return new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setDescription(`${account.content.substring(0, 80)}${account.content.length > 80 ? '...' : ''}`)
            .setValue(account.id)
            .setEmoji(emoji);
    });
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`giveaccount_account_${userId}_${channelId}_${category}`)
        .setPlaceholder(`Select an account to give (${accounts.length} available)`)
        .addOptions(accountOptions.slice(0, 25));
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    let categoryName = 'Discord';
    if (category === 'steam') categoryName = 'Steam';
    if (category === 'fivem') categoryName = 'FiveM';
    
    await interaction.update({
        content: `📦 **Select an account to give to ${targetUser.user.tag} (${categoryName} accounts)**`,
        components: [row],
        flags: 64
    });
});

// ============================================
// GIVEACCOUNT ACCOUNT SELECTION HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('giveaccount_account_')) return;
    
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    const channelId = parts[3];
    const category = parts[4];
    const accountId = interaction.values[0];
    
    const targetUser = await interaction.guild.members.fetch(userId).catch(() => null);
    const targetChannel = interaction.guild.channels.cache.get(channelId);
    
    if (!targetUser) {
        await interaction.reply({ content: '❌ User not found!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    if (!targetChannel) {
        await interaction.reply({ content: '❌ Channel not found!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    const removedAccount = removeAccountById(accountId, category);
    
    if (!removedAccount) {
        await interaction.reply({ content: '❌ Failed to give account. It may have been already given.', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    let typeEmoji = '💬';
    if (removedAccount.type === 'steam') typeEmoji = '🎮';
    if (removedAccount.type === 'fivem') typeEmoji = '🚗';
    
    const accountEmbed = new EmbedBuilder()
        .setTitle(`${typeEmoji} **${removedAccount.type.toUpperCase()} Account Given**`)
        .setDescription(removedAccount.content)
        .setColor(0x00ff00)
        .setThumbnail(LOGO_URL)
        .addFields(
            { name: '👤 Given to', value: targetUser.user.tag, inline: true },
            { name: '🆔 Account ID', value: `\`${removedAccount.id}\``, inline: true },
            { name: '📅 Given at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: `Given by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
    
    await targetChannel.send({ embeds: [accountEmbed] });
    
    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle(`${typeEmoji} **${removedAccount.type.toUpperCase()} Account**`)
            .setDescription(removedAccount.content)
            .setColor(0x00ff00)
            .setThumbnail(LOGO_URL)
            .addFields(
                { name: '📅 Received at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '🔒 Note', value: 'Keep this message private. Do not share with others.', inline: true }
            )
            .setTimestamp();
        
        await targetUser.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.log(`Could not DM ${targetUser.user.tag}: ${error.message}`);
    }
    
    await interaction.reply({ content: `✅ **Account ${accountId}** has been given to ${targetUser.user.tag}!`, flags: 64 });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    
    const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (logChannel) {
        logChannel.send({ content: `📝 **/giveaccount** by ${interaction.user.tag} for ${targetUser.user.tag}\n**Account ID:** ${accountId}\n**Type:** ${removedAccount.type}` }).catch(() => {});
    }
});

// ============================================
// PURCHASE SELECT MENU HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('purchase_select_')) return;
    
    const parts = interaction.customId.split('_');
    const buyerId = parts[2];
    const channelId = parts[3];
    
    const buyer = await interaction.guild.members.fetch(buyerId).catch(() => null);
    const targetChannel = interaction.guild.channels.cache.get(channelId);
    
    if (!buyer) {
        await interaction.reply({ content: '❌ Buyer not found!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    if (!targetChannel) {
        await interaction.reply({ content: '❌ Channel not found!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    const productName = interaction.values[0];
    const purchase = getPurchase(productName);
    
    if (!purchase) {
        await interaction.reply({ content: '❌ Product not found!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    const productEmbed = new EmbedBuilder()
        .setTitle(`🛍️ **${purchase.originalName}**`)
        .setDescription(purchase.content)
        .setColor(0x00ff00)
        .setThumbnail(LOGO_URL)
        .addFields(
            { name: '👤 Purchased by', value: buyer.user.tag, inline: true },
            { name: '🛒 Product', value: purchase.originalName, inline: true },
            { name: '📅 Purchased at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: `Purchase completed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
    
    await targetChannel.send({ embeds: [productEmbed] });
    
    await interaction.reply({ content: `✅ **${purchase.originalName}** has been sent to ${targetChannel}!`, flags: 64 });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    
    const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (logChannel) {
        logChannel.send({ content: `📝 **Purchase** by ${interaction.user.tag} for ${buyer.user.tag}\n**Product:** ${purchase.originalName}\n**Channel:** ${targetChannel.name}` }).catch(() => {});
    }
});

// ============================================
// BUTTON HANDLERS (Storage Refresh/Export)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'refresh_discord') {
        await updateStorageDisplayForType('discord');
        await interaction.reply({ content: '🔄 Discord storage refreshed!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
        return;
    }
    if (interaction.customId === 'refresh_steam') {
        await updateStorageDisplayForType('steam');
        await interaction.reply({ content: '🔄 Steam storage refreshed!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
        return;
    }
    if (interaction.customId === 'refresh_fivem') {
        await updateStorageDisplayForType('fivem');
        await interaction.reply({ content: '🔄 FiveM storage refreshed!', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
        return;
    }
    
    if (interaction.customId === 'export_discord') {
        let exportText = `=== DISCORD ACCOUNTS EXPORT ===\nExported at: ${new Date().toLocaleString()}\nTotal: ${storage.discord.length}\n\n`;
        storage.discord.forEach(a => {
            exportText += `ID: ${a.id}\nContent: ${a.content}\nAdded by: ${a.addedBy}\nAdded at: ${new Date(a.addedAt).toLocaleString()}\n---\n`;
        });
        const buffer = Buffer.from(exportText, 'utf-8');
        await interaction.reply({
            content: '📋 Discord accounts export complete!',
            files: [{ attachment: buffer, name: `discord_export_${Date.now()}.txt` }],
            flags: 64
        });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
        return;
    }
    if (interaction.customId === 'export_steam') {
        let exportText = `=== STEAM ACCOUNTS EXPORT ===\nExported at: ${new Date().toLocaleString()}\nTotal: ${storage.steam.length}\n\n`;
        storage.steam.forEach(a => {
            exportText += `ID: ${a.id}\nContent: ${a.content}\nAdded by: ${a.addedBy}\nAdded at: ${new Date(a.addedAt).toLocaleString()}\n---\n`;
        });
        const buffer = Buffer.from(exportText, 'utf-8');
        await interaction.reply({
            content: '📋 Steam accounts export complete!',
            files: [{ attachment: buffer, name: `steam_export_${Date.now()}.txt` }],
            flags: 64
        });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
        return;
    }
    if (interaction.customId === 'export_fivem') {
        let exportText = `=== FIVEM ACCOUNTS EXPORT ===\nExported at: ${new Date().toLocaleString()}\nTotal: ${storage.fivem.length}\n\n`;
        storage.fivem.forEach(a => {
            exportText += `ID: ${a.id}\nContent: ${a.content}\nAdded by: ${a.addedBy}\nAdded at: ${new Date(a.addedAt).toLocaleString()}\n---\n`;
        });
        const buffer = Buffer.from(exportText, 'utf-8');
        await interaction.reply({
            content: '📋 FiveM accounts export complete!',
            files: [{ attachment: buffer, name: `fivem_export_${Date.now()}.txt` }],
            flags: 64
        });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
        return;
    }
    
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
    
    if (interaction.customId === 'more_info') {
        const embed = new EmbedBuilder()
            .setTitle('❓ Product Info')
            .setDescription('Click **Buy Now** to create a ticket and our team will assist you.')
            .setColor(0x0099ff)
            .setThumbnail(LOGO_URL)
            .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
    }
    
    if (interaction.customId === 'verify_button') {
        const verified = interaction.guild.roles.cache.get(CONFIG.VERIFIED_ROLE_ID);
        const unverified = interaction.guild.roles.cache.get(CONFIG.UNVERIFIED_ROLE_ID);
        if (!verified) return interaction.reply({ content: '❌ Role not set!', flags: 64 });
        if (interaction.member.roles.cache.has(verified.id)) return interaction.reply({ content: '✅ Already verified!', flags: 64 });
        
        await interaction.member.roles.add(verified);
        if (unverified) await interaction.member.roles.remove(unverified);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ **Verification Successful!**')
            .setDescription(`Welcome ${interaction.user}! You now have access to all channels.`)
            .setColor(0x00ff00)
            .setThumbnail(LOGO_URL)
            .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    if (interaction.customId === 'create_ticket_menu') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 **CREATE A SUPPORT TICKET**')
            .setDescription('Please select the category that best fits your needs:')
            .setColor(0x5865F2)
            .setThumbnail(LOGO_URL)
            .addFields(
                { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '⬇️ **SELECT A CATEGORY** ⬇️', inline: false },
                { name: '📋 **General Question**', value: 'General inquiries, questions, or feedback', inline: false },
                { name: '💰 **Purchase**', value: 'Payment issues, transaction problems, or billing', inline: false },
                { name: '🛡️ **Buy Support**', value: 'Premium support for paid services', inline: false }
            )
            .setFooter({ text: 'Choose carefully - this cannot be changed', iconURL: LOGO_URL })
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('general_ticket').setLabel('General Question').setStyle(ButtonStyle.Primary).setEmoji('📋'),
            new ButtonBuilder().setCustomId('purchase_ticket').setLabel('Purchase').setStyle(ButtonStyle.Success).setEmoji('💰'),
            new ButtonBuilder().setCustomId('buysupport_ticket').setLabel('Buy Support').setStyle(ButtonStyle.Danger).setEmoji('🛡️')
        );
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        return;
    }
    
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
// MODAL HANDLER FOR /send
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'send_message_modal') return;
    
    const messageContent = interaction.fields.getTextInputValue('message_content');
    
    if (!messageContent || messageContent.trim() === '') {
        await interaction.reply({ content: '❌ Please provide a message.', flags: 64 });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
        return;
    }
    
    await interaction.channel.send(messageContent);
    
    await interaction.reply({ content: '✅ Message sent!', flags: 64 });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 2000);
    
    const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (logChannel) {
        logChannel.send({ content: `📝 **/send** by ${interaction.user.tag} in ${interaction.channel.name}\n**Message:** ${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}` }).catch(() => {});
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
            .setTitle('🎉 **Welcome to HexMods!** 🎉')
            .setDescription(`Hello ${member.user.username}! Welcome to our community.\n\nPlease verify yourself in <#${CONFIG.VERIFICATION_CHANNEL_ID}> to access all channels.`)
            .setColor(0x00ff00)
            .setThumbnail(LOGO_URL)
            .addFields(
                { name: '📌 Need Help?', value: 'Use the **Ticket System** to create a support ticket.', inline: true },
                { name: '✅ Verify', value: 'Go to the verification channel and click the button!', inline: true }
            )
            .setTimestamp();
        
        await member.send({ embeds: [embed] });
        joinedMembers.add(member.id);
    } catch (error) {}
});

client.on('guildMemberRemove', async (member) => {
    await updateMemberCount(member.guild);
});

client.login(CONFIG.TOKEN);
