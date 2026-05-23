require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    AttachmentBuilder,
    EmbedBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    ActivityType
} = require("discord.js");

const { QuickDB } = require("quick.db");
const db = new QuickDB();

const Canvas = require("canvas");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// ================= CONFIG =================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const LEVEL_CHANNEL_ID = process.env.LEVEL_CHANNEL_ID;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID;

const levelRoles = {
    1: process.env.ROLE_LEVEL_1,
    5: process.env.ROLE_LEVEL_5,
    10: process.env.ROLE_LEVEL_10,
    20: process.env.ROLE_LEVEL_20,
    30: process.env.ROLE_LEVEL_30
};

// ================= VARIABLES =================

const cooldown = new Set();
const voiceUsers = new Map();

// ================= READY =================

client.once("ready", () => {

    console.log(`
╔════════════════════════════╗
║        XP BOT ONLINE       ║
╚════════════════════════════╝
`);

    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    client.user.setPresence({
        activities: [{
            name: "/rank • /top",
            type: ActivityType.Playing
        }],
        status: "online"
    });
});

// ================= AUTO ROLE =================

client.on("guildMemberAdd", async (member) => {

    const role = member.guild.roles.cache.get(AUTO_ROLE_ID);

    if (role) {
        member.roles.add(role).catch(console.error);
    }

    const channel =
        member.guild.channels.cache.get(LEVEL_CHANNEL_ID);

    if (channel) {

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("👋 Nouveau membre")
            .setDescription(
                `Bienvenue ${member} sur le serveur !`
            )
            .setThumbnail(
                member.user.displayAvatarURL()
            );

        channel.send({
            embeds: [embed]
        });
    }
});

// ================= MESSAGE XP =================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;
    if (!message.guild) return;

    if (cooldown.has(message.author.id)) return;

    cooldown.add(message.author.id);

    setTimeout(() => {
        cooldown.delete(message.author.id);
    }, 10000);

    await addXP(message.member, 10);
});

// ================= REACTION XP =================

client.on("messageReactionAdd", async (reaction, user) => {

    if (user.bot) return;

    const member =
        reaction.message.guild.members.cache.get(user.id);

    if (!member) return;

    await addXP(member, 5);
});

// ================= VOICE XP =================

client.on("voiceStateUpdate", async (oldState, newState) => {

    if (!oldState.channel && newState.channel) {

        const interval = setInterval(async () => {

            const member = newState.member;

            if (!member.voice.channel) {
                clearInterval(interval);
                return;
            }

            if (member.voice.channel.members.size <= 1)
                return;

            if (member.voice.selfMute) return;

            await addXP(member, 20);

        }, 5 * 60 * 1000);

        voiceUsers.set(newState.id, interval);
    }

    if (oldState.channel && !newState.channel) {

        const interval = voiceUsers.get(oldState.id);

        if (interval) {
            clearInterval(interval);
            voiceUsers.delete(oldState.id);
        }
    }
});

// ================= ADD XP =================

async function addXP(member, amount) {

    const userId = member.id;
    const guildId = member.guild.id;

    const xpKey = `xp_${guildId}_${userId}`;
    const levelKey = `level_${guildId}_${userId}`;

    let xp = await db.get(xpKey) || 0;
    let level = await db.get(levelKey) || 0;

    xp += amount;

    const neededXP = level * 100 + 100;

    if (xp >= neededXP) {

        level++;
        xp = 0;

        await db.set(levelKey, level);

        // ===== ROLE =====

        if (levelRoles[level]) {

            const role =
                member.guild.roles.cache.get(levelRoles[level]);

            if (role) {
                await member.roles.add(role)
                    .catch(console.error);
            }
        }

        // ===== LEVEL CARD =====

        const canvas = Canvas.createCanvas(900, 300);
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient =
            ctx.createLinearGradient(0, 0, 900, 0);

        gradient.addColorStop(0, "#5865F2");
        gradient.addColorStop(1, "#8B5CF6");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 900, 15);

        const avatar = await Canvas.loadImage(
            member.user.displayAvatarURL({
                extension: "png",
                size: 256
            })
        );

        ctx.save();

        ctx.beginPath();
        ctx.arc(150, 150, 90, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(avatar, 60, 60, 180, 180);

        ctx.restore();

        ctx.beginPath();
        ctx.arc(150, 150, 95, 0, Math.PI * 2);
        ctx.strokeStyle = "#5865F2";
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 42px Sans";

        ctx.fillText(
            member.user.username,
            300,
            120
        );

        ctx.font = "30px Sans";
        ctx.fillStyle = "#9CA3AF";

        ctx.fillText(
            `🎉 Niveau ${level} atteint !`,
            300,
            180
        );

        ctx.fillStyle = "#374151";
        ctx.fillRect(300, 220, 500, 30);

        ctx.fillStyle = "#5865F2";
        ctx.fillRect(300, 220, 500, 30);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px Sans";

        ctx.fillText("LEVEL UP", 670, 70);

        const attachment = new AttachmentBuilder(
            canvas.toBuffer(),
            { name: "levelup.png" }
        );

        const levelChannel =
            member.guild.channels.cache.get(LEVEL_CHANNEL_ID);

        if (levelChannel) {

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setDescription(
                    `🚀 ${member} vient de passer niveau ${level} !`
                )
                .setImage("attachment://levelup.png")
                .setTimestamp();

            levelChannel.send({
                embeds: [embed],
                files: [attachment]
            });
        }
    }

    await db.set(xpKey, xp);
}

// ================= COMMANDES =================

const commands = [

    new SlashCommandBuilder()
        .setName("top")
        .setDescription("Voir le classement XP"),

    new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Voir ton niveau")

].map(command => command.toJSON());

const rest = new REST({ version: "10" })
    .setToken(TOKEN);

(async () => {

    try {

        console.log("⌛ Chargement des commandes...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log("✅ Commandes chargées");

    } catch (error) {
        console.error(error);
    }

})();

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

    if (!interaction.isChatInputCommand()) return;

    // ===== TOP =====

    if (interaction.commandName === "top") {

        const all = await db.all();

        const xpData = all
            .filter(data =>
                data.id.startsWith(
                    `xp_${interaction.guild.id}`
                )
            )
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        let leaderboard = "";

        for (let i = 0; i < xpData.length; i++) {

            const data = xpData[i];

            const userId = data.id.split("_")[2];

            const user =
                await client.users.fetch(userId)
                    .catch(() => null);

            if (!user) continue;

            leaderboard +=
                `🏅 **#${i + 1}** • ${user.username} — ${data.value} XP\n`;
        }

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🏆 Classement XP")
            .setDescription(leaderboard)
            .setTimestamp();

        interaction.reply({
            embeds: [embed]
        });
    }

    // ===== RANK =====

    if (interaction.commandName === "rank") {

        const xp =
            await db.get(
                `xp_${interaction.guild.id}_${interaction.user.id}`
            ) || 0;

        const level =
            await db.get(
                `level_${interaction.guild.id}_${interaction.user.id}`
            ) || 0;

        const neededXP = level * 100 + 100;

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`📊 ${interaction.user.username}`)
            .setThumbnail(
                interaction.user.displayAvatarURL()
            )
            .addFields(
                {
                    name: "⭐ Niveau",
                    value: `${level}`,
                    inline: true
                },
                {
                    name: "✨ XP",
                    value: `${xp}/${neededXP}`,
                    inline: true
                }
            )
            .setTimestamp();

        interaction.reply({
            embeds: [embed]
        });
    }
});

// ================= LOGIN =================

client.login(TOKEN);
