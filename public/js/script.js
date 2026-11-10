
const $ = (id) => document.getElementById(id);

let configSite = {};
let introIniciada = false;
let despedidaIniciada = false;
let musicaIniciada = false;

const falasLucky = [
  "Oii! Eu sou o Lucky! ♡",
  "Fui criado especialmente para receber vocês.",
  "Preparei um cantinho cheio de carinho!",
  "Essas asinhas representam duas pessoas especiais.",
  "Agora... sejam bem-vindos ao nosso pequeno mundo!"
];

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function falar(texto) {
  const speech = $("speech");
  const speechText = $("speechText");

  if (!speech || !speechText) return;

  speech.classList.remove("speech-changing");

  setTimeout(() => {
    speechText.textContent = texto;
    speech.classList.add("speech-changing");
  }, 100);
}

async function iniciarIntroducao() {
  if (introIniciada) return;
  introIniciada = true;

  const cena = document.querySelector(".welcome-scene");

  for (const fala of falasLucky) {
    falar(fala);
    await esperar(2600);
  }

  finalizarIntroducao();
}

async function finalizarIntroducao() {
  const intro = $("intro");
  const world = $("world");
  const cena = document.querySelector(".welcome-scene");

  if (!intro || !world) return;

  cena?.classList.add("join");

  falar("Preparem-se... nosso mundo vai começar! ♡");

  await esperar(1700);

  intro.classList.add("hide");
  world.classList.add("visible");

  iniciarAnimacaoCards();
}

$("skipIntro")?.addEventListener("click", () => {
  finalizarIntroducao();
});

$("lucky")?.addEventListener("click", () => {
  const frases = [
    "Eu adoro vocês! ♡",
    "Cuidem bem desse mundinho!",
    "As asas estão voando!",
    "Tem muita coisa especial aqui.",
    "Não esqueçam de abrir a cartinha!"
  ];

  falar(frases[Math.floor(Math.random() * frases.length)]);
});

// ========================================
// CARREGAR CONFIGURAÇÕES DO ADMIN
// ========================================

async function carregarConteudo() {
  try {
    const resposta = await fetch("/api/site", {
      cache: "no-store"
    });

    if (!resposta.ok) {
      throw new Error("Não foi possível carregar o conteúdo.");
    }

    configSite = await resposta.json();

    carregarFotos();
    carregarCarta();
    carregarMusica();

  } catch (erro) {
    console.error("Erro ao carregar o site:", erro);
  }
}

function carregarFotos() {
  const fotos = configSite.fotos || [];

  for (let i = 0; i < 2; i++) {
    const numero = i + 1;
    const foto = fotos[i];

    const img = $(`photo${numero}`);
    const placeholder = $(`placeholder${numero}`);
    const legenda = $(`caption${numero}`);

    if (!img || !foto) continue;

    if (foto.arquivo) {
      img.src = normalizarCaminho(foto.arquivo);

      img.onload = () => {
        img.classList.add("loaded");
        placeholder?.classList.add("hidden");
      };

      img.onerror = () => {
        img.classList.remove("loaded");
        placeholder?.classList.remove("hidden");
      };
    }

    if (foto.legenda) {
      legenda.textContent = foto.legenda;
    }
  }
}

function normalizarCaminho(caminho) {
  if (!caminho) return "";

  if (/^https?:\/\//i.test(caminho)) {
    return caminho;
  }

  if (caminho.startsWith("/")) {
    return caminho;
  }

  return "/" + caminho.replace(/^\.?\//, "");
}

// ========================================
// CARTA
// ========================================

function carregarCarta() {
  const mensagem = configSite.mensagem || "Uma mensagem especial para vocês.";

  $("letterMessage").textContent = mensagem;
}

$("openLetter")?.addEventListener("click", async () => {
  const overlay = $("letterOverlay");

  overlay?.classList.add("open");
  overlay?.setAttribute("aria-hidden", "false");

  // O navegador exige interação do usuário para iniciar áudio.
  iniciarMusica();
});

$("closeLetter")?.addEventListener("click", fecharCarta);

$("letterOverlay")?.addEventListener("click", (event) => {
  if (event.target === $("letterOverlay")) {
    fecharCarta();
  }
});

function fecharCarta() {
  $("letterOverlay")?.classList.remove("open");
  $("letterOverlay")?.setAttribute("aria-hidden", "true");
}

// ========================================
// MÚSICA
// ========================================

function carregarMusica() {
  const musicas = configSite.musicas || [];
  const audio = $("audioPlayer");

  if (!audio || musicas.length === 0) {
    return;
  }

  const primeiraMusica = musicas[0];

  const caminho = typeof primeiraMusica === "string"
    ? primeiraMusica
    : primeiraMusica.arquivo;

  if (!caminho) return;

  audio.src = normalizarCaminho(caminho);
  audio.load();
}

async function iniciarMusica() {
  const audio = $("audioPlayer");

  if (!audio || !audio.src || musicaIniciada) return;

  try {
    await audio.play();
    musicaIniciada = true;
  } catch (erro) {
    console.warn("O navegador bloqueou a reprodução automática:", erro);
  }
}

// ========================================
// ANIMAÇÃO DOS CARDS
// ========================================

function iniciarAnimacaoCards() {
  const cards = document.querySelectorAll(".memory-card");

  if (!("IntersectionObserver" in window)) {
    cards.forEach(card => card.classList.add("show"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15
  });

  cards.forEach(card => observer.observe(card));
}

// ========================================
// ASAS INTERATIVAS 3D
// ========================================

const wingWorld = $("wingWorld");
const leftWing = $("leftWing");
const rightWing = $("rightWing");

if (wingWorld && window.matchMedia("(pointer: fine)").matches) {
  wingWorld.addEventListener("mousemove", (event) => {
    const rect = wingWorld.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const rotateY = (x - 0.5) * 35;
    const rotateX = (0.5 - y) * 20;

    leftWing.style.transform =
      `rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateY(-8px)`;

    rightWing.style.transform =
      `rotateY(${-rotateY}deg) rotateX(${-rotateX}deg) translateY(-8px)`;
  });

  wingWorld.addEventListener("mouseleave", () => {
    leftWing.style.transform = "";
    rightWing.style.transform = "";
  });
}

// Clique nas asas
[leftWing, rightWing].forEach((wing) => {
  wing?.addEventListener("click", () => {
    wing.classList.remove("wing-click");
    void wing.offsetWidth;
    wing.classList.add("wing-click");
  });
});

// ========================================
// DESPEDIDA DO LUCKY
// ========================================

const mensagemFinal = [
  "Espero que tenham gostado,",
  "desejo sorte e muita prosperidade",
  "na vida de cada um de voces.",
  "",
  "Meu dono me pediu para dizer isso",
  "por ele.",
  "",
  "by lut999z"
].join("\n");

async function digitarMensagem() {
  const destino = $("cmdText");

  if (!destino) return;

  destino.textContent = "";

  for (const caractere of mensagemFinal) {
    destino.textContent += caractere;
    await esperar(caractere === "\n" ? 350 : 35);
  }
}

async function iniciarDespedida() {
  if (despedidaIniciada) return;

  despedidaIniciada = true;

  const lucky = $("goodbyeLucky");
  const cmd = $("cmdWindow");
  const fala = $("goodbyeSpeech");

  if (!cmd) return;

  if (fala) {
    fala.textContent = "Chegamos ao final, me despeço pelo meu dono...";
  }

  await esperar(1800);

  // Lucky desce e revela o terminal.
  if (lucky) {
    lucky.style.transform = "translateY(35px) scale(.85)";
    lucky.style.opacity = ".3";
  }

  await esperar(500);

  cmd.classList.add("pulled");

  await esperar(1200);

  await digitarMensagem();
}

function observarDespedida() {
  const section = $("goodbye");

  if (!section) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        iniciarDespedida();
        observer.disconnect();
      }
    });
  }, {
    threshold: 0.3
  });

  observer.observe(section);
}

$("replayGoodbye")?.addEventListener("click", async () => {
  despedidaIniciada = false;

  const lucky = $("goodbyeLucky");
  const cmd = $("cmdWindow");

  if (lucky) {
    lucky.style.transform = "";
    lucky.style.opacity = "1";
  }

  cmd?.classList.remove("pulled");

  $("cmdText").textContent = "";

  await esperar(500);

  iniciarDespedida();
});

// ========================================
// INICIALIZAÇÃO
// ========================================

carregarConteudo();
iniciarIntroducao();
observarDespedida();
