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

    if (cooldown.has(message.author.id))
        return;

    cooldown.add(message.author.id);

    setTimeout(() => {
        cooldown.delete(message.author.id);
    }, 3000);

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

                    // XP même mute
                    // XP même seul

                    await addXP(
                        member,
                        10
                    );

                }, 1 * 60 * 1000);

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

        try {

            const canvas =
                Canvas.createCanvas(
                    900,
                    300
                );

            const ctx =
                canvas.getContext("2d");

            ctx.fillStyle =
                "#111827";

            ctx.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

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

            ctx.fillStyle =
                "#ffffff";

            ctx.font =
                "bold 42px Sans";

            ctx.fillText(
                member.user.username,
                300,
                120
            );

            ctx.fillStyle =
                "#9CA3AF";

            ctx.font =
                "30px Sans";

            ctx.fillText(
                `🎉 Niveau ${newLevel} atteint !`,
                300,
                180
            );

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
        ),

    // ================= GIVEAWAY =================

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription(
            "Créer un giveaway"
        )
        .addStringOption(option =>
            option
                .setName("prix")
                .setDescription(
                    "Le lot"
                )
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("temps")
                .setDescription(
                    "Temps en minutes"
                )
                .setRequired(true)
        ),

    // ================= GIVEAWAYXP =================

    new SlashCommandBuilder()
        .setName("giveawayxp")
        .setDescription(
            "Donner de l'xp à tout le serveur"
        )
        .addIntegerOption(option =>
            option
                .setName("xp")
                .setDescription(
                    "Nombre d'xp"
                )
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

        // ================= GIVEAWAY =================

        if (
            interaction.commandName ===
            "giveaway"
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

            const prize =
                interaction.options.getString(
                    "prix"
                );

            const time =
                interaction.options.getInteger(
                    "temps"
                );

            const embed =
                new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle("🎉 GIVEAWAY 🎉")
                    .setDescription(`
🎁 **Lot :** ${prize}

⏰ Temps :
${time} minute(s)

🎊 Réagis avec 🎉 pour participer !
                    `);

            const msg =
                await interaction.channel.send({
                    embeds: [embed]
                });

            await msg.react("🎉");

            interaction.reply({
                content:
                    "✅ Giveaway lancé.",
                ephemeral: true
            });

            setTimeout(async () => {

                const fetched =
                    await msg.fetch();

                const reaction =
                    fetched.reactions.cache.get(
                        "🎉"
                    );

                if (!reaction)
                    return;

                const users =
                    await reaction.users.fetch();

                const filtered =
                    users.filter(
                        u => !u.bot
                    );

                if (
                    filtered.size <= 0
                ) {

                    interaction.channel.send(
                        "❌ Aucun participant."
                    );

                    return;
                }

                const winner =
                    filtered.random();

                interaction.channel.send(
                    `🎉 Félicitations ${winner} tu as gagné **${prize}** !`
                );

            }, time * 60 * 1000);
        }

        // ================= GIVEAWAYXP =================

        if (
            interaction.commandName ===
            "giveawayxp"
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

            const amount =
                interaction.options.getInteger(
                    "xp"
                );

            const members =
                interaction.guild.members.cache;

            members.forEach(async member => {

                if (member.user.bot)
                    return;

                await addXP(
                    member,
                    amount
                );
            });

            interaction.reply({
                content:
                    `✅ ${amount} XP donné à tout le serveur.`
            });
        }
    }
);

// ================= LOGIN =================

client.login(TOKEN);
