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
const Canvas = require("canvas");

const db = new QuickDB();

// ================= CLIENT =================

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
const GUILD_ID = process.env.GUILD_ID;

const LEVEL_CHANNEL_ID =
    process.env.LEVEL_CHANNEL_ID;

const AUTO_ROLE_ID =
    process.env.AUTO_ROLE_ID;

const STAFF_ROLE_ID =
    process.env.STAFF_ROLE_ID;

// ================= LEVEL ROLES =================

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

client.once("clientReady", async () => {

    console.log(`
╔════════════════════════════╗
║        XP BOT ONLINE       ║
╚════════════════════════════╝
`);

    console.log(`✅ ${client.user.tag} connecté`);

    client.user.setPresence({
        activities: [
            {
                name: "/rank • /top",
                type: ActivityType.Playing
            }
        ],
        status: "online"
    });

});

// ================= AUTO ROLE =================

client.on("guildMemberAdd", async (member) => {

    const role =
        member.guild.roles.cache.get(
            AUTO_ROLE_ID
        );

    if (role) {
        member.roles.add(role)
            .catch(console.error);
    }

    const channel =
        member.guild.channels.cache.get(
            LEVEL_CHANNEL_ID
        );

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

    // anti spam
    if (cooldown.has(message.author.id))
        return;

    cooldown.add(message.author.id);

    setTimeout(() => {
        cooldown.delete(message.author.id);
    }, 3000);

    // 25 XP message
    await addXP(message.member, 25);
});

// ================= REACTION XP =================

client.on(
    "messageReactionAdd",
    async (reaction, user) => {

        if (user.bot) return;

        const member =
            reaction.message.guild.members.cache.get(
                user.id
            );

        if (!member) return;

        // 10 XP réaction
        await addXP(member, 5);
    }
);

// ================= VOICE XP =================

client.on(
    "voiceStateUpdate",
    async (oldState, newState) => {

        // rejoint vocal
        if (
            !oldState.channel &&
            newState.channel
        ) {

            const interval =
                setInterval(async () => {

                    const member =
                        newState.member;

                    // quitté vocal
                    if (
                        !member.voice.channel
                    ) {

                        clearInterval(interval);

                        return;
                    }

                    // XP même mute
                    // XP même seul
                    // 50 XP toutes les 1 minute

                    await addXP(
                        member,
                        5
                    );

                }, 1 * 60 * 1000);

            voiceUsers.set(
                newState.id,
                interval
            );
        }

        // quitte vocal
        if (
            oldState.channel &&
            !newState.channel
        ) {

            const interval =
                voiceUsers.get(
                    oldState.id
                );

            if (interval) {

                clearInterval(interval);

                voiceUsers.delete(
                    oldState.id
                );
            }
        }
    }
);

// ================= CALCUL LEVEL =================

function calculateLevel(xp) {

    if (xp >= 30000) return 30;
    if (xp >= 20000) return 20;
    if (xp >= 10000) return 10;
    if (xp >= 5000) return 5;
    if (xp >= 1000) return 1;

    return 0;
}

// ================= ADD XP =================

async function addXP(member, amount) {

    const xpKey =
        `xp_${member.guild.id}_${member.id}`;

    const levelKey =
        `level_${member.guild.id}_${member.id}`;

    let xp =
        await db.get(xpKey) || 0;

    let oldLevel =
        await db.get(levelKey) || 0;

    // ajoute xp
    xp += amount;

    // save xp
    await db.set(xpKey, xp);

    // nouveau niveau
    const newLevel =
        calculateLevel(xp);

    // ================= LEVEL UP =================

    if (newLevel > oldLevel) {

        await db.set(
            levelKey,
            newLevel
        );

        // ===== ROLE =====

        if (levelRoles[newLevel]) {

            const role =
                member.guild.roles.cache.get(
                    levelRoles[newLevel]
                );

            if (role) {

                try {
                    await member.roles.add(role);
                } catch (err) {
                    console.log(err);
                }
            }
        }

        // ================= CARD =================

        try {

            const canvas =
                Canvas.createCanvas(
                    900,
                    300
                );

            const ctx =
                canvas.getContext("2d");

            // fond
            ctx.fillStyle =
                "#111827";

            ctx.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            // gradient
            const gradient =
                ctx.createLinearGradient(
                    0,
                    0,
                    900,
                    0
                );

            gradient.addColorStop(
                0,
                "#5865F2"
            );

            gradient.addColorStop(
                1,
                "#8B5CF6"
            );

            ctx.fillStyle =
                gradient;

            ctx.fillRect(
                0,
                0,
                900,
                15
            );

            // avatar
            const avatar =
                await Canvas.loadImage(
                    member.user.displayAvatarURL({
                        extension: "png",
                        size: 256
                    })
                );

            ctx.save();

            ctx.beginPath();

            ctx.arc(
                150,
                150,
                90,
                0,
                Math.PI * 2
            );

            ctx.closePath();

            ctx.clip();

            ctx.drawImage(
                avatar,
                60,
                60,
                180,
                180
            );

            ctx.restore();

            // border
            ctx.beginPath();

            ctx.arc(
                150,
                150,
                95,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                "#5865F2";

            ctx.lineWidth = 8;

            ctx.stroke();

            // username
            ctx.fillStyle =
                "#ffffff";

            ctx.font =
                "bold 42px Sans";

            ctx.fillText(
                member.user.username,
                300,
                120
            );

            // level
            ctx.fillStyle =
                "#9CA3AF";

            ctx.font =
                "30px Sans";

            ctx.fillText(
                `🎉 Niveau ${newLevel} atteint !`,
                300,
                180
            );

            // xp
            ctx.fillStyle =
                "#ffffff";

            ctx.font =
                "24px Sans";

            ctx.fillText(
                `${xp} XP`,
                300,
                230
            );

            const attachment =
                new AttachmentBuilder(
                    canvas.toBuffer(),
                    {
                        name:
                            "levelup.png"
                    }
                );

            const levelChannel =
                member.guild.channels.cache.get(
                    LEVEL_CHANNEL_ID
                );

            if (levelChannel) {

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            "#5865F2"
                        )
                        .setDescription(
                            `🚀 ${member} vient de passer niveau ${newLevel} !`
                        )
                        .setImage(
                            "attachment://levelup.png"
                        );

                levelChannel.send({
                    embeds: [embed],
                    files: [attachment]
                });
            }

        } catch (err) {

            console.log(
                "Erreur Canvas:",
                err
            );
        }
    }
}

// ================= COMMANDES =================

const commands = [

    new SlashCommandBuilder()
        .setName("rank")
        .setDescription(
            "Voir ton niveau"
        ),

    new SlashCommandBuilder()
        .setName("top")
        .setDescription(
            "Voir le classement XP"
        ),

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription(
            "Voir le ping du bot"
        ),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription(
            "Voir les commandes"
        ),

    new SlashCommandBuilder()
        .setName("addxp")
        .setDescription(
            "Ajouter de l'xp"
        )
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription(
                    "Le membre"
                )
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("xp")
                .setDescription(
                    "Nombre d'xp"
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("resetxp")
        .setDescription(
            "Reset l'xp"
        )
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription(
                    "Le membre"
                )
                .setRequired(true)
        )

].map(command =>
    command.toJSON()
);

// ================= REGISTER =================

const rest =
    new REST({ version: "10" })
        .setToken(TOKEN);

(async () => {

    try {

        console.log(
            "⌛ Chargement des commandes..."
        );

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            { body: commands }
        );

        console.log(
            "✅ Commandes chargées"
        );

    } catch (error) {
        console.error(error);
    }

})();

// ================= INTERACTIONS =================

client.on(
    "interactionCreate",
    async (interaction) => {

        if (
            !interaction.isChatInputCommand()
        ) return;

        // ================= RANK =================

        if (
            interaction.commandName ===
            "rank"
        ) {

            const xp =
                await db.get(
                    `xp_${interaction.guild.id}_${interaction.user.id}`
                ) || 0;

            const level =
                await db.get(
                    `level_${interaction.guild.id}_${interaction.user.id}`
                ) || 0;

            const embed =
                new EmbedBuilder()
                    .setColor(
                        "#5865F2"
                    )
                    .setTitle(
                        `📊 ${interaction.user.username}`
                    )
                    .setThumbnail(
                        interaction.user.displayAvatarURL()
                    )
                    .addFields(
                        {
                            name:
                                "⭐ Niveau",
                            value:
                                `${level}`,
                            inline: true
                        },
                        {
                            name:
                                "✨ XP",
                            value:
                                `${xp}`,
                            inline: true
                        }
                    );

            interaction.reply({
                embeds: [embed]
            });
        }

        // ================= TOP =================

        if (
            interaction.commandName ===
            "top"
        ) {

            const all =
                await db.all();

            const xpData = all
                .filter(data =>
                    data.id.startsWith(
                        `xp_${interaction.guild.id}`
                    )
                )
                .sort(
                    (a, b) =>
                        b.value -
                        a.value
                )
                .slice(0, 10);

            let leaderboard = "";

            for (
                let i = 0;
                i < xpData.length;
                i++
            ) {

                const data =
                    xpData[i];

                const userId =
                    data.id.split(
                        "_"
                    )[2];

                const user =
                    await client.users.fetch(
                        userId
                    )
                        .catch(
                            () => null
                        );

                if (!user)
                    continue;

                leaderboard +=
                    `🏅 #${i + 1} • ${user.username} — ${data.value} XP\n`;
            }

            if (!leaderboard) {

                leaderboard =
                    "❌ Aucun joueur dans le classement.";
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        "#5865F2"
                    )
                    .setTitle(
                        "🏆 Classement XP"
                    )
                    .setDescription(
                        leaderboard
                    );

            interaction.reply({
                embeds: [embed]
            });
        }

        // ================= PING =================

        if (
            interaction.commandName ===
            "ping"
        ) {

            interaction.reply({
                content:
                    `🏓 Pong : ${client.ws.ping}ms`
            });
        }

        // ================= HELP =================

        if (
            interaction.commandName ===
            "help"
        ) {

            const embed =
                new EmbedBuilder()
                    .setColor(
                        "#5865F2"
                    )
                    .setTitle(
                        "📚 Commandes"
                    )
                    .setDescription(`
\`/rank\` → Voir ton niveau
\`/top\` → Classement XP
\`/ping\` → Voir le ping
\`/help\` → Voir les commandes
\`/addxp\` → Ajouter de l'xp
\`/resetxp\` → Reset l'xp
                    `);

            interaction.reply({
                embeds: [embed]
            });
        }

        // ================= ADDXP =================

        if (
            interaction.commandName ===
            "addxp"
        ) {

            if (
                !interaction.member.roles.cache.has(
                    STAFF_ROLE_ID
                )
            ) {

                return interaction.reply({
                    content:
                        "❌ Tu n'as pas la permission.",
                    ephemeral: true
                });
            }

            const member =
                interaction.options.getMember(
                    "membre"
                );

            const amount =
                interaction.options.getInteger(
                    "xp"
                );

            await addXP(
                member,
                amount
            );

            interaction.reply({
                content:
                    `✅ ${amount} XP ajouté à ${member}`
            });
        }

        // ================= RESETXP =================

        if (
            interaction.commandName ===
            "resetxp"
        ) {

            if (
                !interaction.member.roles.cache.has(
                    STAFF_ROLE_ID
                )
            ) {

                return interaction.reply({
                    content:
                        "❌ Tu n'as pas la permission.",
                    ephemeral: true
                });
            }

            const member =
                interaction.options.getMember(
                    "membre"
                );

            await db.set(
                `xp_${interaction.guild.id}_${member.id}`,
                0
            );

            await db.set(
                `level_${interaction.guild.id}_${member.id}`,
                0
            );

            interaction.reply({
                content:
                    `✅ XP reset pour ${member}`
            });
        }
    }
);

// ================= LOGIN =================

client.login(TOKEN);
