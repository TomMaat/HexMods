const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');

// ============================================
// PLACEHOLDERS - EDIT THESE VALUES
// ============================================
const CONFIG = {
    // Ticket settings
    TICKET_CATEGORY_ID: '1509666778916327434',           // Category where tickets will be created
    SUPPORT_ROLE_ID: '1509664538281381908',           // Role that can see/claim tickets
    TRANSCRIPT_CHANNEL_ID: '1509665662455251165', // Channel for ticket transcripts
    LOG_CHANNEL_ID: '1509665549410635787',               // Channel for bot logs
    
    // Messages
    TICKET_CREATION_CHANNEL_ID: 'YOUR_TICKET_CHANNEL', // Channel where ticket button appears
    
    // Bot settings
    TOKEN: 'YOUR_BOT_TOKEN_HERE'
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

// Store tickets
const tickets = new Map();

// ============================================
// HELPER FUNCTIONS
// ============================================
async function createTicketChannel(user, interaction) {
    const guild = interaction.guild;
    const supportRole = guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
    
    // Create ticket channel
    const channel = await guild.channels.create({
        name: `ticket-${user.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: CONFIG.TICKET_CATEGORY_ID,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
            },
            {
                id: supportRole.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
            }
        ]
    });
    
    tickets.set(channel.id, {
        userId: user.id,
        claimedBy: null,
        createdAt: Date.now()
    });
    
    // Send ticket embed
    const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket Created')
        .setDescription(`Welcome ${user.toString()}! Support team will assist you shortly.\nUse the buttons below to manage this ticket.`)
        .setColor(0x00ff00)
        .setFooter({ text: `Ticket ID: ${channel.id}` })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Claim Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎯'),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId('transcript')
                .setLabel('Get Transcript')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📄')
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
    let transcript = `Ticket Transcript: ${channel.name}\nCreated: ${new Date(tickets.get(channel.id).createdAt).toLocaleString()}\n\n`;
    
    messages.reverse().forEach(msg => {
        transcript += `[${msg.author.tag}] (${msg.createdAt.toLocaleString()}): ${msg.content || '(embed/attachment)'}\n`;
    });
    
    const transcriptChannel = interaction.guild.channels.cache.get(CONFIG.TRANSCRIPT_CHANNEL_ID);
    if (transcriptChannel) {
        const embed = new EmbedBuilder()
            .setTitle('📝 Ticket Transcript')
            .setDescription(`Transcript for ${channel.name}`)
            .setColor(0x00aaff)
            .setTimestamp();
        
        await transcriptChannel.send({
            embeds: [embed],
            files: [{
                attachment: Buffer.from(transcript, 'utf-8'),
                name: `${channel.name}-transcript.txt`
            }]
        });
    }
}

// ============================================
// EVENT HANDLERS
// ============================================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    // Set status
    client.user.setActivity('Tickets System', { type: 'WATCHING' });
    
    // Keep-alive ping every 5 minutes (300,000 ms)
    setInterval(() => {
        console.log('🔄 Keep-alive ping');
        client.user.setActivity('Tickets System', { type: 'WATCHING' });
    }, 300000);
    
    // Send welcome DM to all members (existing and new)
    const guild = client.guilds.cache.first();
    if (guild) {
        console.log(`🔄 Sending welcome DMs to existing members...`);
        const members = await guild.members.fetch();
        members.forEach(async (member) => {
            if (!member.user.bot) {
                try {
                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle('🎉 Welcome to the Server!')
                        .setDescription(`Hello ${member.user.username}, welcome to the server!\n\nIf you need support, please use the ticket system.`)
                        .setColor(0x00ff00)
                        .setFooter({ text: 'Bot Ticket System' })
                        .setTimestamp();
                    
                    await member.send({ embeds: [welcomeEmbed] });
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit avoidance
                } catch (error) {
                    console.log(`Couldn't DM ${member.user.tag}: ${error.message}`);
                }
            }
        });
        console.log(`✅ Finished sending welcome DMs`);
    }
});

// Welcome DM for new members
client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Welcome to the Server!')
            .setDescription(`Hello ${member.user.username}, welcome to the server!\n\nIf you need support, please use the ticket system.`)
            .setColor(0x00ff00)
            .setFooter({ text: 'Bot Ticket System' })
            .setTimestamp();
        
        await member.send({ embeds: [welcomeEmbed] });
        console.log(`📨 Sent welcome DM to ${member.user.tag}`);
    } catch (error) {
        console.log(`Couldn't send welcome DM to ${member.user.tag}: ${error.message}`);
    }
});

// Handle the /msg command
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Check for /msg command
    if (message.content.startsWith('/msg ')) {
        const supportRole = message.guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
        
        // Check if user has the support role
        if (message.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID)) {
            const msgContent = message.content.slice(5);
            
            const embed = new EmbedBuilder()
                .setTitle('📨 Message from Support')
                .setDescription(msgContent)
                .setColor(0x0099ff)
                .setFooter({ text: `Sent by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();
            
            // Delete the command message
            await message.delete().catch(console.error);
            
            // Send as bot in the channel
            await message.channel.send({ embeds: [embed] });
        }
    }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const ticketData = tickets.get(interaction.channelId);
    if (!ticketData) return;
    
    // Claim ticket
    if (interaction.customId === 'claim_ticket') {
        const supportRole = interaction.guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
        
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
            .setDescription(`Ticket has been claimed by ${interaction.user.toString()}`)
            .setColor(0xffaa00)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        // DM the user that their ticket was claimed
        const user = await interaction.guild.members.fetch(ticketData.userId);
        if (user) {
            const claimEmbed = new EmbedBuilder()
                .setTitle('✅ Your Ticket Has Been Claimed')
                .setDescription(`Your ticket in ${interaction.guild.name} has been claimed by ${interaction.user.tag}!\nThey will assist you shortly.`)
                .setColor(0x00ff00)
                .setTimestamp();
            
            await user.send({ embeds: [claimEmbed] }).catch(() => console.log('Could not DM user'));
        }
    }
    
    // Close ticket
    if (interaction.customId === 'close_ticket') {
        const hasPerm = interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) || ticketData.userId === interaction.user.id;
        
        if (!hasPerm) {
            return interaction.reply({ content: '❌ You do not have permission to close this ticket!', ephemeral: true });
        }
        
        await interaction.reply({ content: '🔒 Ticket will be deleted in 5 seconds...' });
        
        setTimeout(async () => {
            await sendTranscript(interaction.channel, interaction);
            await interaction.channel.delete();
            tickets.delete(interaction.channelId);
        }, 5000);
    }
    
    // Get transcript
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

// Ticket creation command
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket System')
            .setDescription('Click the button below to create a support ticket.\nA support team member will assist you as soon as possible.')
            .setColor(0x00ff00)
            .setFooter({ text: 'Support System' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎫')
            );
        
        await interaction.reply({ embeds: [embed], components: [row] });
    }
});

// Handle create ticket button
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'create_ticket') {
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
        
        await interaction.reply({ content: '🎫 Creating your ticket...', ephemeral: true });
        const channel = await createTicketChannel(interaction.user, interaction);
        await interaction.editReply({ content: `✅ Ticket created: ${channel.toString()}`, ephemeral: true });
    }
});

// ============================================
// REGISTER SLASH COMMANDS
// ============================================
async function registerCommands(guildId) {
    const commands = [
        {
            name: 'ticket',
            description: 'Create a support ticket',
            options: []
        },
        {
            name: 'ping',
            description: 'Check bot latency',
            options: []
        }
    ];
    
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        await guild.commands.set(commands);
        console.log('✅ Slash commands registered!');
    }
}

// Login
client.login(CONFIG.TOKEN);

client.once('ready', async () => {
    const guild = client.guilds.cache.first();
    if (guild) {
        await registerCommands(guild.id);
    }
    
    // Setup ticket creation button in specific channel
    const ticketChannel = client.channels.cache.get(CONFIG.TICKET_CREATION_CHANNEL_ID);
    if (ticketChannel) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Tickets')
            .setDescription('Click the button below to create a support ticket.\nOur team will help you as soon as possible.')
            .setColor(0x00ff00)
            .setFooter({ text: 'Ticket System' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎫')
            );
        
        // Clear previous messages and send new one
        const messages = await ticketChannel.messages.fetch();
        await ticketChannel.bulkDelete(messages);
        await ticketChannel.send({ embeds: [embed], components: [row] });
    }
});