
const express = require("express");
const multer = require("multer");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

// ================================================
// CONFIGURAÇÕES
// ================================================

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");

// No Render, configure STORAGE_DIR=/var/data
// Localmente, os arquivos ficam dentro do projeto.
const STORAGE_ROOT = process.env.STORAGE_DIR || ROOT;

const DATA = path.join(STORAGE_ROOT, "data", "site.json");
const FOTOS = path.join(STORAGE_ROOT, "assets", "fotos");
const MUSICAS = path.join(STORAGE_ROOT, "assets", "musicas");

// Senha local padrão: lut123
// No Render, ADMIN_PASSWORD configurada nas variáveis de ambiente
// terá prioridade.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "lut123";

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "chave-local-temporaria-altere-no-render";

const DEFAULT_CONFIG = {
    mensagem: "Meu lugar favorito é ao seu lado.",
    fotos: [
        { arquivo: "", legenda: "" },
        { arquivo: "", legenda: "" },
        { arquivo: "", legenda: "" }
    ],
    musicas: []
};

// ================================================
// CRIAÇÃO DE DIRETÓRIOS
// ================================================

for (const dir of [
    path.dirname(DATA),
    FOTOS,
    MUSICAS
]) {
    fs.mkdirSync(dir, { recursive: true });
}

// ================================================
// CONFIGURAÇÃO INICIAL
// ================================================

if (!fs.existsSync(DATA)) {
    fs.writeFileSync(
        DATA,
        JSON.stringify(DEFAULT_CONFIG, null, 2)
    );
}

// ================================================
// LEITURA E SALVAMENTO
// ================================================

function lerConfig() {
    try {
        const config = JSON.parse(
            fs.readFileSync(DATA, "utf8")
        );

        return {
            ...DEFAULT_CONFIG,
            ...config
        };
    } catch (error) {
        console.error("Erro ao ler configuração:", error);
        return DEFAULT_CONFIG;
    }
}

function salvarConfig(config) {
    const temp = DATA + ".tmp";

    fs.writeFileSync(
        temp,
        JSON.stringify(config, null, 2),
        "utf8"
    );

    fs.renameSync(temp, DATA);
}

// ================================================
// MIDDLEWARES
// ================================================

app.set("trust proxy", 1);

app.use(express.json({
    limit: "1mb"
}));

app.use(session({
    name: "our_world_admin",

    secret: SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 4 * 60 * 60 * 1000
    }
}));

// ================================================
// AUTENTICAÇÃO
// ================================================

function autenticado(req, res, next) {
    if (!req.session || !req.session.admin) {
        return res.status(401).json({
            erro: "Não autorizado."
        });
    }

    next();
}

// ================================================
// UPLOAD DE ARQUIVOS
// ================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === "fotos") {
            return cb(null, FOTOS);
        }

        if (file.fieldname === "musicas") {
            return cb(null, MUSICAS);
        }

        cb(new Error("Campo de upload inválido."));
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        const nome = crypto.randomBytes(16).toString("hex");

        cb(null, nome + ext);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 15 * 1024 * 1024,
        files: 13
    },

    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        const imagens = [
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        ];

        const audios = [
            ".mp3",
            ".ogg",
            ".wav",
            ".m4a"
        ];

        if (
            file.fieldname === "fotos" &&
            imagens.includes(ext)
        ) {
            return cb(null, true);
        }

        if (
            file.fieldname === "musicas" &&
            audios.includes(ext)
        ) {
            return cb(null, true);
        }

        cb(new Error("Formato de arquivo não permitido."));
    }
});

// ================================================
// ARQUIVOS ESTÁTICOS
// ================================================

// Fotos e músicas: diretório configurável/persistente.
app.use(
    "/assets/fotos",
    express.static(FOTOS)
);

app.use(
    "/assets/musicas",
    express.static(MUSICAS)
);

// Arquivos públicos do site: CSS, JS, HTML etc.
app.use(express.static(PUBLIC));

// ================================================
// PAINEL ADMINISTRATIVO
// ================================================

app.get("/admin", (req, res) => {
    res.sendFile(
        path.join(ROOT, "admin", "admin.html")
    );
});

app.use(
    "/admin-files",
    express.static(path.join(ROOT, "admin"))
);

// ================================================
// LOGIN
// ================================================

app.post("/api/login", (req, res, next) => {
    const senha = req.body?.senha;

    if (
        typeof senha !== "string" ||
        senha !== ADMIN_PASSWORD
    ) {
        return res.status(401).json({
            erro: "Senha incorreta."
        });
    }

    // Regenera a sessão após autenticar.
    req.session.regenerate((error) => {
        if (error) {
            return next(error);
        }

        req.session.admin = true;

        req.session.save((saveError) => {
            if (saveError) {
                return next(saveError);
            }

            res.json({
                sucesso: true
            });
        });
    });
});

// ================================================
// VERIFICAR SESSÃO
// ================================================

app.get("/api/status", autenticado, (req, res) => {
    res.json({
        autenticado: true
    });
});

// ================================================
// LOGOUT
// ================================================

app.post("/api/logout", autenticado, (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie("our_world_admin");

        res.json({
            sucesso: true
        });
    });
});

// ================================================
// CONFIGURAÇÃO PÚBLICA
// ================================================

app.get("/api/site", (req, res) => {
    res.set("Cache-Control", "no-store");

    res.json(lerConfig());
});

// ================================================
// SALVAR ALTERAÇÕES DO ADMIN
// ================================================

app.post(
    "/api/site",
    autenticado,

    upload.fields([
        { name: "fotos", maxCount: 3 },
        { name: "musicas", maxCount: 10 }
    ]),

    (req, res) => {
        try {
            const config = JSON.parse(
                req.body.config || "{}"
            );

            const atual = lerConfig();

            // VALIDAR CONFIGURAÇÃO
            if (
                typeof config.mensagem !== "string" ||
                !Array.isArray(config.fotos) ||
                config.fotos.length !== 3 ||
                !Array.isArray(config.musicas)
            ) {
                return res.status(400).json({
                    erro: "Configuração inválida."
                });
            }

            const novasFotos =
                req.files?.fotos || [];

            const novasMusicas =
                req.files?.musicas || [];

            // ========================================
            // FOTOS
            // ========================================

            config.fotos = config.fotos.map((foto, i) => ({
                arquivo: novasFotos[i]
                    ? `/assets/fotos/${novasFotos[i].filename}`
                    : (atual.fotos?.[i]?.arquivo || ""),

                legenda: String(
                    foto?.legenda || ""
                ).slice(0, 120)
            }));

            // ========================================
            // MÚSICAS
            // ========================================

            const musicasExistentes = config.musicas
                .filter(m =>
                    m &&
                    typeof m.arquivo === "string" &&
                    m.arquivo.startsWith("/assets/musicas/")
                )
                .map(m => ({
                    titulo: String(m.titulo || "Música").slice(0, 100),
                    arquivo: m.arquivo
                }));

            const musicasNovas = novasMusicas.map(m => ({
                titulo: path.parse(m.originalname).name.slice(0, 100),

                arquivo: `/assets/musicas/${m.filename}`
            }));

            config.musicas = [
                ...musicasExistentes,
                ...musicasNovas
            ];

            // ========================================
            // MENSAGEM
            // ========================================

            config.mensagem = config.mensagem.slice(0, 1000);

            // ========================================
            // SALVAR
            // ========================================

            salvarConfig(config);

            res.json({
                sucesso: true,
                mensagem: "Alterações salvas com sucesso."
            });

        } catch (error) {
            console.error("Erro ao salvar:", error);

            res.status(400).json({
                erro: "Não foi possível salvar."
            });
        }
    }
);

// ================================================
// ROTA DE VERIFICAÇÃO
// ================================================

app.get("/api/health", (req, res) => {
    res.json({
        online: true,
        projeto: "Our Little World"
    });
});

// ================================================
// TRATAMENTO DE ERROS
// ================================================

app.use((error, req, res, next) => {
    console.error("Erro no servidor:", error);

    res.status(400).json({
        erro: error.message || "Erro ao processar requisição."
    });
});

// ================================================
// INICIAR SERVIDOR
// ================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("================================");
    console.log("       OUR LITTLE WORLD");
    console.log("================================");
    console.log(`PORTA: ${PORT}`);
    console.log("SERVIDOR INICIADO");
    console.log("================================");
    console.log("");
});
