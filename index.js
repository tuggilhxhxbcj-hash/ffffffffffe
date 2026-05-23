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

// ================= JOIN =================

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

    if (!channel) return;

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
});

// ================= LEAVE =================

client.on("guildMemberRemove", async (member) => {

    const channel =
        member.guild.channels.cache.get(
            LEVEL_CHANNEL_ID
        );

    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("👋 Membre parti")
        .setDescription(
            `😢 ${member.user.username} a quitté le serveur.`
        );

    channel.send({
        embeds: [embed]
    });
});

// ================= BOOST =================

client.on("guildMemberUpdate", async (oldMember, newMember) => {

    if (!oldMember.premiumSince && newMember.premiumSince) {

        const channel =
            newMember.guild.channels.cache.get(
                LEVEL_CHANNEL_ID
            );

        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor("#FF73FA")
            .setTitle("🚀 Nouveau Boost !")
            .setDescription(
                `💎 ${newMember} vient de booster le serveur !`
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

    if (cooldown.has(message.author.id))
        return;

    cooldown.add(message.author.id);

    setTimeout(() => {
        cooldown.delete(message.author.id);
    }, 10000);

    await addXP(message.member, 10);
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

        await addXP(member, 5);
    }
);

// ================= VOICE XP =================

client.on(
    "voiceStateUpdate",
    async (oldState, newState) => {

        if (
            !oldState.channel &&
            newState.channel
        ) {

            const interval =
                setInterval(async () => {

                    const member =
                        newState.member;

                    if (
                        !member.voice.channel
                    ) {

                        clearInterval(interval);

                        return;
                    }

                    if (
                        member.voice.channel.members.size <= 1
                    ) return;

                    if (
                        member.voice.selfMute
                    ) return;

                    if (
                        member.voice.selfDeaf
                    ) return;

                    if (
                        member.voice.channel.id ===
                        member.guild.afkChannelId
                    ) return;

                    await addXP(
                        member,
                        20
                    );

                }, 5 * 60 * 1000);

            voiceUsers.set(
                newState.id,
                interval
            );
        }

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

// ================= LEVEL =================

function calculateLevel(xp) {

    if (xp >= 3000) return 30;
    if (xp >= 2000) return 20;
    if (xp >= 1000) return 10;
    if (xp >= 500) return 5;
    if (xp >= 100) return 1;

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

    xp += amount;

    await db.set(xpKey, xp);

    const newLevel =
        calculateLevel(xp);

    if (newLevel > oldLevel) {

        await db.set(
            levelKey,
            newLevel
        );

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

        const levelChannel =
            member.guild.channels.cache.get(
                LEVEL_CHANNEL_ID
            );

        if (levelChannel) {

            const embed =
                new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle("🚀 Niveau augmenté")
                    .setDescription(
                        `${member} est maintenant niveau ${newLevel}`
                    );

            levelChannel.send({
                embeds: [embed]
            });
        }
    }
}

// ================= COMMANDES =================

const commands = [

    new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Voir ton niveau"),

    new SlashCommandBuilder()
        .setName("top")
        .setDescription("Voir le classement"),

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Voir le ping"),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Voir les commandes"),

    new SlashCommandBuilder()
        .setName("addxp")
        .setDescription("Ajouter XP")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Le membre")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("xp")
                .setDescription("XP")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("resetxp")
        .setDescription("Reset XP")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Le membre")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Créer un giveaway")
        .addStringOption(option =>
            option
                .setName("prix")
                .setDescription("Le prix")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("temps")
                .setDescription("Temps en minutes")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("giveawayxp")
        .setDescription("Créer un giveaway XP")
        .addIntegerOption(option =>
            option
                .setName("xp")
                .setDescription("XP")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("temps")
                .setDescription("Temps")
                .setRequired(true)
        )

].map(command =>
    command.toJSON());

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

        // ================= STAFF =================

        const staffOnly = [
            "addxp",
            "resetxp",
            "giveaway",
            "giveawayxp"
        ];

        if (
            staffOnly.includes(
                interaction.commandName
            )
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
        }

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
                    .setColor("#5865F2")
                    .setTitle(
                        `📊 ${interaction.user.username}`
                    )
                    .addFields(
                        {
                            name: "⭐ Niveau",
                            value: `${level}`,
                            inline: true
                        },
                        {
                            name: "✨ XP",
                            value: `${xp}`,
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
                    data.id.split("_")[2];

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

            const embed =
                new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle("🏆 Classement XP")
                    .setDescription(
                        leaderboard || "❌ Aucun joueur."
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
                    `🏓 ${client.ws.ping}ms`
            });
        }

        // ================= HELP =================

        if (
            interaction.commandName ===
            "help"
        ) {

            const embed =
                new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle("📚 Commandes")
                    .setDescription(`
/rank
/top
/ping
/help
/addxp
/resetxp
/giveaway
/giveawayxp
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

        // ================= GIVEAWAY =================

        if (
            interaction.commandName ===
            "giveaway"
        ) {

            const prize =
                interaction.options.getString(
                    "prix"
                );

            const minutes =
                interaction.options.getInteger(
                    "temps"
                );

            const embed =
                new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle("🎉 GIVEAWAY")
                    .setDescription(`
🎁 Prix : **${prize}**

⏰ Temps : ${minutes} minute(s)

🎊 Réagis avec 🎉 !
                    `);

            const msg =
                await interaction.channel.send({
                    embeds: [embed]
                });

            await msg.react("🎉");

            interaction.reply({
                content:
                    "✅ Giveaway lancé",
                ephemeral: true
            });

            setTimeout(async () => {

                const fetched =
                    await msg.fetch();

                const reaction =
                    fetched.reactions.cache.get(
                        "🎉"
                    );

                if (!reaction) return;

                const users =
                    await reaction.users.fetch();

                const validUsers =
                    users.filter(
                        u => !u.bot
                    );

                if (
                    validUsers.size <= 0
                ) {

                    return interaction.channel.send(
                        "❌ Aucun participant."
                    );
                }

                const winner =
                    validUsers.random();

                interaction.channel.send(
                    `🎉 ${winner} a gagné **${prize}**`
                );

            }, minutes * 60000);
        }

        // ================= GIVEAWAY XP =================

        if (
            interaction.commandName ===
            "giveawayxp"
        ) {

            const xpAmount =
                interaction.options.getInteger(
                    "xp"
                );

            const minutes =
                interaction.options.getInteger(
                    "temps"
                );

            const embed =
                new EmbedBuilder()
                    .setColor("#F59E0B")
                    .setTitle("⭐ GIVEAWAY XP")
                    .setDescription(`
✨ XP : **${xpAmount}**

⏰ Temps : ${minutes} minute(s)

🎊 Réagis avec ⭐ !
                    `);

            const msg =
                await interaction.channel.send({
                    embeds: [embed]
                });

            await msg.react("⭐");

            interaction.reply({
                content:
                    "✅ Giveaway XP lancé",
                ephemeral: true
            });

            setTimeout(async () => {

                const fetched =
                    await msg.fetch();

                const reaction =
                    fetched.reactions.cache.get(
                        "⭐"
                    );

                if (!reaction) return;

                const users =
                    await reaction.users.fetch();

                const validUsers =
                    users.filter(
                        u => !u.bot
                    );

                if (
                    validUsers.size <= 0
                ) {

                    return interaction.channel.send(
                        "❌ Aucun participant."
                    );
                }

                const winner =
                    validUsers.random();

                const member =
                    interaction.guild.members.cache.get(
                        winner.id
                    );

                await addXP(
                    member,
                    xpAmount
                );

                interaction.channel.send(
                    `🎉 ${winner} a gagné ${xpAmount} XP`
                );

            }, minutes * 60000);
        }
    }
);

// ================= LOGIN =================

client.login(TOKEN);
