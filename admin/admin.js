
const $ = id => document.getElementById(id);

let config = {
    mensagem: "",
    fotos: [],
    musicas: []
};

let musicasNovas = [];

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.erro || "Erro na solicitação.");
    }

    return data;
}

function mostrarPainel() {
    $("login").hidden = true;
    $("painel").hidden = false;
}

function mostrarLogin() {
    $("login").hidden = false;
    $("painel").hidden = true;
}

async function carregar() {
    config = await api("/api/site");

    $("mensagem").value = config.mensagem || "";

    for (let i = 0; i < 3; i++) {
        const foto = config.fotos[i] || {};

        $("legenda" + i).value = foto.legenda || "";
        $("preview" + i).src = foto.arquivo || "";
    }

    renderizarMusicas();
}

function renderizarMusicas() {
    const lista = $("listaMusicas");
    lista.innerHTML = "";

    config.musicas.forEach((musica, i) => {
        const row = document.createElement("div");
        row.className = "music-row";

        const nome = document.createElement("input");
        nome.value = musica.titulo || "";
        nome.addEventListener("input", () => {
            musica.titulo = nome.value;
        });

        const remover = document.createElement("button");
        remover.textContent = "Remover";
        remover.onclick = () => {
            config.musicas.splice(i, 1);
            renderizarMusicas();
        };

        row.append(nome, remover);
        lista.appendChild(row);
    });

    musicasNovas.forEach((arquivo, i) => {
        const row = document.createElement("div");
        row.className = "music-row";

        const nome = document.createElement("span");
        nome.textContent = arquivo.name;

        const remover = document.createElement("button");
        remover.textContent = "Cancelar";
        remover.onclick = () => {
            musicasNovas.splice(i, 1);
            renderizarMusicas();
        };

        row.append(nome, remover);
        lista.appendChild(row);
    });
}

$("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    try {
        await api("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senha: $("senha").value })
        });

        await carregar();
        mostrarPainel();
    } catch (error) {
        $("erro").textContent = error.message;
    }
});

for (let i = 0; i < 3; i++) {
    $("foto" + i).addEventListener("change", event => {
        const arquivo = event.target.files[0];
        if (!arquivo) return;

        if (arquivo.size > 15 * 1024 * 1024) {
            alert("A foto deve ter no máximo 15 MB.");
            event.target.value = "";
            return;
        }

        $("preview" + i).src = URL.createObjectURL(arquivo);
    });
}

$("musicas").addEventListener("change", event => {
    for (const arquivo of event.target.files) {
        if (arquivo.size > 15 * 1024 * 1024) {
            alert(`${arquivo.name} ultrapassa 15 MB.`);
            continue;
        }

        if (musicasNovas.length + config.musicas.length >= 10) {
            alert("Limite de 10 músicas.");
            break;
        }

        musicasNovas.push(arquivo);
    }

    event.target.value = "";
    renderizarMusicas();
});

$("salvar").addEventListener("click", async () => {
    const botao = $("salvar");
    botao.disabled = true;
    $("status").textContent = "Salvando...";

    try {
        const dados = {
            mensagem: $("mensagem").value,
            fotos: Array.from({ length: 3 }, (_, i) => ({
                legenda: $("legenda" + i).value
            })),
            musicas: config.musicas
        };

        const form = new FormData();
        form.append("config", JSON.stringify(dados));

        for (let i = 0; i < 3; i++) {
            const foto = $("foto" + i).files[0];
            if (foto) form.append("fotos", foto);
        }

        musicasNovas.forEach(musica => {
            form.append("musicas", musica);
        });

        const resultado = await api("/api/site", {
            method: "POST",
            body: form
        });

        musicasNovas = [];

        for (let i = 0; i < 3; i++) {
            $("foto" + i).value = "";
        }

        await carregar();

        $("status").textContent = resultado.mensagem;
    } catch (error) {
        $("status").textContent = error.message;
    } finally {
        botao.disabled = false;
    }
});

$("sair").addEventListener("click", async () => {
    try {
        await api("/api/logout", { method: "POST" });
    } finally {
        mostrarLogin();
    }
});

(async () => {
    try {
        await api("/api/status");
        await carregar();
        mostrarPainel();
    } catch {
        mostrarLogin();
    }
})();
