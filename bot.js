const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');

// ============================================
// CONFIG - ALLEEN ENVIRONMENT VARIABLES
// ============================================
const CONFIG = {
    // Ticket settings - 3 CATEGORIES
    GENERAL_CATEGORY_ID: process.env.GENERAL_CATEGORY_ID,
    PURCHASE_CATEGORY_ID: process.env.PURCHASE_CATEGORY_ID,
    BUY_SUPPORT_CATEGORY_ID: process.env.BUY_SUPPORT_CATEGORY_ID,
    
    SUPPORT_ROLE_ID: process.env.SUPPORT_ROLE_ID || '1509663687449903134',
    MSG_ROLE_ID: process.env.MSG_ROLE_ID,
    TRANSCRIPT_CHANNEL_ID: process.env.TRANSCRIPT_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    
    TICKET_CREATION_CHANNEL_ID: process.env.TICKET_CREATION_CHANNEL_ID,
    
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

// Store tickets
const tickets = new Map();

// ============================================
// HELPER FUNCTIONS
// ============================================
async function createTicketChannel(user, interaction, categoryId, ticketType) {
    const guild = interaction.guild;
    const supportRole = guild.roles.cache.get(CONFIG.SUPPORT_ROLE_ID);
    
    let prefix = '';
    switch(ticketType) {
        case 'General Question':
            prefix = 'general';
            break;
        case 'Purchase':
            prefix = 'purchase';
            break;
        case 'Buy Support':
            prefix = 'buysupport';
            break;
        default:
            prefix = 'ticket';
    }
    
    const channel = await guild.channels.create({
        name: `${prefix}-${user.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: categoryId,
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
// EVENT HANDLERS
// ============================================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    client.user.setActivity('Ticket System', { type: 'WATCHING' });
    
    // Keep-alive ping every 5 minutes
    setInterval(() => {
        console.log('🔄 Keep-alive ping');
        client.user.setActivity('Ticket System', { type: 'WATCHING' });
    }, 300000);
    
    // Send welcome DM to all existing members
    const guild = client.guilds.cache.first();
    if (guild) {
        console.log(`🔄 Sending welcome DMs to existing members...`);
        const members = await guild.members.fetch();
        let dmCount = 0;
        for (const member of members.values()) {
            if (!member.user.bot) {
                try {
                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle('🎉 Welcome to the Server!')
                        .setDescription(`Hello ${member.user.username}! Welcome to our community.`)
                        .setColor(0x00ff00)
                        .addFields(
                            { name: '📌 Need Help?', value: 'Use the **Ticket System** in the support channel to create a ticket.', inline: true },
                            { name: '📜 Rules', value: 'Please read the rules before participating.', inline: true },
                            { name: '💬 Questions', value: 'Feel free to ask in the appropriate channels!', inline: true }
                        )
                        .setThumbnail(guild.iconURL())
                        .setFooter({ text: 'We hope you enjoy your stay!', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();
                    
                    await member.send({ embeds: [welcomeEmbed] });
                    dmCount++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log(`Couldn't DM ${member.user.tag}: ${error.message}`);
                }
            }
        }
        console.log(`✅ Sent welcome DMs to ${dmCount} members`);
    }
});

// Welcome DM for new members
client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Welcome to the Server!')
            .setDescription(`Hello ${member.user.username}! Welcome to our community.`)
            .setColor(0x00ff00)
            .addFields(
                { name: '📌 Need Help?', value: 'Use the **Ticket System** in the support channel to create a ticket.', inline: true },
                { name: '📜 Rules', value: 'Please read the rules before participating.', inline: true },
                { name: '💬 Questions', value: 'Feel free to ask in the appropriate channels!', inline: true }
            )
            .setThumbnail(member.guild.iconURL())
            .setFooter({ text: 'We hope you enjoy your stay!', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        await member.send({ embeds: [welcomeEmbed] });
        console.log(`📨 Sent welcome DM to ${member.user.tag}`);
    } catch (error) {
        console.log(`Couldn't send welcome DM to ${member.user.tag}: ${error.message}`);
    }
});

// ============================================
// /MSG COMMAND - SENDS AS BOT IN SAME CHANNEL
// ============================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.startsWith('/msg ')) {
        if (!message.member.roles.cache.has(CONFIG.MSG_ROLE_ID)) {
            const errorMsg = await message.reply({
                content: '❌ You do not have permission to use the `/msg` command.',
                allowedMentions: { repliedUser: false }
            });
            setTimeout(async () => {
                await message.delete().catch(() => {});
                await errorMsg.delete().catch(() => {});
            }, 3000);
            return;
        }
        
        const msgContent = message.content.slice(5);
        
        if (!msgContent || msgContent.trim() === '') {
            const errorMsg = await message.reply({
                content: '❌ Please provide a message. Usage: `/msg your message here`',
                allowedMentions: { repliedUser: false }
            });
            setTimeout(async () => {
                await message.delete().catch(() => {});
                await errorMsg.delete().catch(() => {});
            }, 3000);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(msgContent)
            .setColor(0x0099ff)
            .setFooter({ text: 'Support Message', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        await message.delete().catch(console.error);
        await message.channel.send({ embeds: [embed] });
        
        const logChannel = message.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📝 /msg Command Used')
                .setDescription(`**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel.name}\n**Message:** ${msgContent.substring(0, 500)}`)
                .setColor(0xffaa00)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
});

// ============================================
// BUTTON INTERACTIONS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const ticketData = tickets.get(interaction.channelId);
    if (!ticketData) return;
    
    // Claim ticket
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
        
        const user = await interaction.guild.members.fetch(ticketData.userId);
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
    
    // Close ticket
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

// ============================================
// TICKET CREATION - EMBED WITH 3 CATEGORIES
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket System')
            .setDescription('Please select the type of ticket you want to create from the buttons below.')
            .setColor(0x00ff00)
            .addFields(
                { name: '📋 General Question', value: 'Ask questions about the server, community, or general topics.', inline: true },
                { name: '💰 Purchase', value: 'Questions about purchases, transactions, or payments.', inline: true },
                { name: '🛡️ Buy Support', value: 'Dedicated support for paid services or premium features.', inline: true }
            )
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Support team will assist you shortly', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('general_ticket')
                    .setLabel('General Question')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId('purchase_ticket')
                    .setLabel('Purchase')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId('buysupport_ticket')
                    .setLabel('Buy Support')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🛡️')
            );
        
        await interaction.reply({ embeds: [embed], components: [row] });
    }
    
    if (interaction.commandName === 'ping') {
        await interaction.reply(`🏓 Pong! Latency: ${Date.now() - interaction.createdTimestamp}ms`);
    }
});

// Handle ticket creation buttons
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    let categoryId = null;
    let ticketType = null;
    
    if (interaction.customId === 'general_ticket') {
        categoryId = CONFIG.GENERAL_CATEGORY_ID;
        ticketType = 'General Question';
    } else if (interaction.customId === 'purchase_ticket') {
        categoryId = CONFIG.PURCHASE_CATEGORY_ID;
        ticketType = 'Purchase';
    } else if (interaction.customId === 'buysupport_ticket') {
        categoryId = CONFIG.BUY_SUPPORT_CATEGORY_ID;
        ticketType = 'Buy Support';
    }
    
    if (categoryId && ticketType) {
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
        
        await interaction.reply({ content: `🎫 Creating your ${ticketType} ticket...`, ephemeral: true });
        const channel = await createTicketChannel(interaction.user, interaction, categoryId, ticketType);
        await interaction.editReply({ content: `✅ ${ticketType} ticket created: ${channel.toString()}`, ephemeral: true });
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
    
    const ticketChannel = client.channels.cache.get(CONFIG.TICKET_CREATION_CHANNEL_ID);
    if (ticketChannel) {
        const messages = await ticketChannel.messages.fetch();
        if (messages.size > 0) {
            await ticketChannel.bulkDelete(messages).catch(() => console.log('Could not clear channel'));
        }
        
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
});

// Handle the main create ticket button that shows the category menu
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
                new ButtonBuilder()
                    .setCustomId('general_ticket')
                    .setLabel('General Question')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId('purchase_ticket')
                    .setLabel('Purchase')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId('buysupport_ticket')
                    .setLabel('Buy Support')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🛡️')
            );
        
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
});
