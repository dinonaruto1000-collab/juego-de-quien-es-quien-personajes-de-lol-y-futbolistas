// ====================================================================
// CONTROLADOR PRINCIPAL DE LA INTERFAZ Y ESTADO DEL JUEGO
// ====================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Referencias al DOM
    const screens = {
        menu: document.getElementById('screen-menu'),
        pickSecret: document.getElementById('screen-pick-secret'),
        coinToss: document.getElementById('screen-coin-toss'),
        gameplay: document.getElementById('screen-gameplay'),
        gameOver: document.getElementById('screen-game-over')
    };

    const engineBadge = document.getElementById('engine-status-badge');
    const muteBtn = document.getElementById('mute-btn');
    const startMatchBtn = document.getElementById('start-match-btn');
    const playAgainBtn = document.getElementById('play-again-btn');

    const boardGrid = document.getElementById('board-grid');
    const secretPickGrid = document.getElementById('secret-pick-grid');
    const userSecretThumb = document.getElementById('user-secret-thumb');
    const userSecretName = document.getElementById('user-secret-name');
    const turnIndicatorText = document.getElementById('turn-text-player');
    const turnPulse = document.getElementById('turn-pulse');
    const dialogueBar = document.getElementById('dialogue-text');
    const dialogueSpeaker = document.getElementById('dialogue-speaker');

    const btnAsk = document.getElementById('btn-ask');
    const btnGuess = document.getElementById('btn-guess');

    const modalQuestions = document.getElementById('modal-questions');
    const modalGuess = document.getElementById('modal-guess');
    const closeQuestionsModal = document.getElementById('close-questions-modal');
    const closeGuessModal = document.getElementById('close-guess-modal');
    const questionsList = document.getElementById('questions-list');
    const filterTabsContainer = document.getElementById('filter-tabs');
    const guessGrid = document.getElementById('guess-grid');

    let currentConfig = {
        modo: 'futbol',
        dificultad: 'dificil'
    };

    let activeFilterCat = 'Todos';
    let isProcessingTurn = false;

    // Detectar backend de SWI-Prolog
    async function updateEngineStatus() {
        const status = await window.gameEngine.checkBackend();
        if (status.online) {
            engineBadge.className = 'engine-badge';
            engineBadge.innerHTML = '● SWI-Prolog Activo (Port 8002)';
        } else {
            engineBadge.className = 'engine-badge local';
            engineBadge.innerHTML = '⚡ Motor Local Autónomo';
        }
    }
    await updateEngineStatus();

    // Toggle Sonido
    muteBtn.addEventListener('click', () => {
        const muted = window.gameAudio.toggleMute();
        muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    // Navegación de Pantallas
    function showScreen(name) {
        Object.keys(screens).forEach(key => {
            if (screens[key]) screens[key].classList.remove('active');
        });
        if (screens[name]) screens[name].classList.add('active');
    }

    // Configuración de Opciones en el Menú
    document.querySelectorAll('.pill-option').forEach(pill => {
        pill.addEventListener('click', () => {
            window.gameAudio.playClick();
            const group = pill.closest('.pill-selector');
            group.querySelectorAll('.pill-option').forEach(p => p.classList.remove('selected'));
            pill.classList.add('selected');

            const configType = pill.dataset.config;
            const value = pill.dataset.value;
            currentConfig[configType] = value;
        });
    });

    // Iniciar Partida desde Menú
    startMatchBtn.addEventListener('click', async () => {
        window.gameAudio.playClick();
        startMatchBtn.disabled = true;
        startMatchBtn.textContent = 'Cargando tablero...';

        try {
            const data = await window.gameEngine.iniciarPartida(currentConfig.modo, currentConfig.dificultad, 20);
            renderSecretPickGrid(data.tablero);
            showScreen('pickSecret');
        } catch (err) {
            alert('Error al iniciar partida: ' + err.message);
        } finally {
            startMatchBtn.disabled = false;
            startMatchBtn.textContent = 'Comenzar Duelo';
        }
    });

    // Renderizar Tablero de Elección de Personaje Secreto
    function renderSecretPickGrid(tablero) {
        secretPickGrid.innerHTML = '';
        tablero.forEach(personaje => {
            const card = document.createElement('div');
            card.className = 'guess-card-item';
            card.innerHTML = `
                <img class="guess-card-img" src="${personaje.imagen}" alt="${personaje.nombre}" onerror="this.src='images/banner.png'">
                <div class="guess-card-name">${personaje.nombre}</div>
                <div style="font-size: 10px; color: var(--text-muted);">${personaje.subtitulo}</div>
            `;
            card.addEventListener('click', async () => {
                window.gameAudio.playSuccess();
                await window.gameEngine.fijarPersonajeUsuario(personaje.id);
                // Mostrar datos en el dashboard
                userSecretThumb.src = personaje.imagen;
                userSecretName.textContent = personaje.nombre;

                // Pasar a la pantalla de la moneda
                iniciarSorteoMoneda();
            });
            secretPickGrid.appendChild(card);
        });
    }

    // Animación de la Moneda al Aire
    function iniciarSorteoMoneda() {
        showScreen('coinToss');
        const coin = document.getElementById('coin-element');
        const tossStatus = document.getElementById('toss-status');
        const primerTurno = window.gameEngine.gameState.primerTurno;

        coin.classList.remove('flipping');
        void coin.offsetWidth; // Trigger reflow
        coin.classList.add('flipping');
        window.gameAudio.playCoinToss();

        tossStatus.textContent = 'Lanzando moneda al aire...';

        setTimeout(() => {
            if (primerTurno === 'usuario') {
                coin.textContent = '👤';
                tossStatus.innerHTML = '<strong style="color: var(--accent-cyan); font-size: 18px;">¡La suerte te favorece! Tú comienzas la partida.</strong>';
            } else {
                coin.textContent = '🤖';
                tossStatus.innerHTML = '<strong style="color: var(--accent-purple); font-size: 18px;">¡La IA ha ganado el sorteo! La IA comienza el primer turno.</strong>';
            }

            setTimeout(() => {
                arrancarTableroPrincipal();
            }, 1800);
        }, 1800);
    }

    // Arrancar Partida en Pantalla Principal
    function arrancarTableroPrincipal() {
        renderBoard(window.gameEngine.gameState.tablero);
        renderQuestionsFilterTabs(window.gameEngine.gameState.preguntas);
        renderQuestionsList(window.gameEngine.gameState.preguntas);
        renderGuessModalGrid(window.gameEngine.gameState.tablero);

        showScreen('gameplay');
        actualizarEstadoTurno();
    }

    // Renderizar Tablero Principal con Cartas 3D
    function renderBoard(tablero) {
        boardGrid.innerHTML = '';
        tablero.forEach(personaje => {
            const wrapper = document.createElement('div');
            wrapper.className = 'card-wrapper';
            wrapper.id = `card-${personaje.id}`;

            const catLabel = personaje.categoria === 'futbol' ? 'Fútbol' : 'LoL';
            const catClass = personaje.categoria === 'futbol' ? '' : 'lol';

            wrapper.innerHTML = `
                <div class="game-card">
                    <div class="card-front">
                        <div class="card-img-container">
                            <img class="card-img" src="${personaje.imagen}" alt="${personaje.nombre}" onerror="this.src='images/banner.png'">
                            <span class="card-cat-badge ${catClass}">${catLabel}</span>
                        </div>
                        <div class="card-info">
                            <div class="card-name">${personaje.nombre}</div>
                            <div class="card-sub">${personaje.subtitulo}</div>
                        </div>
                    </div>
                    <div class="card-back">
                        <div class="card-discarded-stamp">DESCARTADO</div>
                    </div>
                </div>
            `;

            // Clic manual para voltear/desvoltear
            wrapper.addEventListener('click', () => {
                window.gameAudio.playCardFlip();
                wrapper.classList.toggle('flipped');
            });

            boardGrid.appendChild(wrapper);
        });
    }

    // Actualizar Turno y Diálogo
    function actualizarEstadoTurno() {
        const turno = window.gameEngine.gameState.turnoActual;

        if (turno === 'usuario') {
            turnIndicatorText.textContent = 'Tu Turno';
            turnIndicatorText.style.color = 'var(--accent-cyan)';
            turnPulse.className = 'turn-pulse';
            btnAsk.disabled = false;
            btnGuess.disabled = false;
            dialogueSpeaker.textContent = 'Tu Turno';
            dialogueBar.textContent = 'Elige una acción: haz una pregunta sobre el personaje secreto de la IA o intenta adivinarlo.';
        } else if (turno === 'ia') {
            turnIndicatorText.textContent = 'Turno de la IA';
            turnIndicatorText.style.color = 'var(--accent-purple)';
            turnPulse.className = 'turn-pulse ia-turn';
            btnAsk.disabled = true;
            btnGuess.disabled = true;
            dialogueSpeaker.textContent = 'La IA está pensando...';
            dialogueBar.textContent = 'La IA está analizando los personajes restantes y preparando su jugada.';

            // Ejecutar turno de la IA tras pequeña pausa para realismo
            setTimeout(ejecutarTurnoIA, 1500);
        }
    }

    // Turno de la IA
    async function ejecutarTurnoIA() {
        if (isProcessingTurn) return;
        isProcessingTurn = true;

        try {
            const data = await window.gameEngine.turnoIA();

            if (data.tipo_accion === 'adivinanza') {
                if (data.acierto) {
                    window.gameAudio.playFail();
                    mostrarGameOver(false, data.personaje_adivinado, data.mensaje);
                    return;
                } else {
                    window.gameAudio.playSuccess();
                    dialogueSpeaker.textContent = 'La IA falló su adivinanza';
                    dialogueBar.textContent = `La IA arriesgó intentando adivinar a "${data.personaje_adivinado.nombre}", ¡pero no era tu personaje! Pierde su turno.`;
                }
            } else {
                // Pregunta
                const respuestaBadge = data.respuesta_usuario === 'si' ? '¡SÍ!' : '¡NO!';
                dialogueSpeaker.textContent = 'Pregunta de la IA';
                dialogueBar.innerHTML = `La IA pregunta: <em>"${data.pregunta_texto}"</em> &rarr; Tu personaje: <strong>${respuestaBadge}</strong> (Quedan ${data.ia_candidatos_restantes_count} candidatos para la IA).`;
                window.gameAudio.playCardFlip();
            }

            actualizarEstadoTurno();
        } catch (err) {
            console.error('Error turno IA:', err);
        } finally {
            isProcessingTurn = false;
        }
    }

    // Modal Preguntas: Pestañas de Filtro
    function renderQuestionsFilterTabs(preguntas) {
        const categorias = ['Todos', ...new Set(preguntas.map(p => p.categoria))];
        filterTabsContainer.innerHTML = '';

        categorias.forEach(cat => {
            const tab = document.createElement('button');
            tab.className = `filter-tab ${cat === activeFilterCat ? 'active' : ''}`;
            tab.textContent = cat;
            tab.addEventListener('click', () => {
                window.gameAudio.playClick();
                filterTabsContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeFilterCat = cat;
                renderQuestionsList(preguntas);
            });
            filterTabsContainer.appendChild(tab);
        });
    }

    // Renderizar Lista de Preguntas Filtradas
    function renderQuestionsList(preguntas) {
        questionsList.innerHTML = '';
        const filtradas = activeFilterCat === 'Todos'
            ? preguntas
            : preguntas.filter(p => p.categoria === activeFilterCat);

        filtradas.forEach(item => {
            const row = document.createElement('div');
            row.className = 'question-item';
            row.innerHTML = `
                <div class="question-item-text">${item.pregunta}</div>
                <span class="question-item-cat">${item.categoria}</span>
            `;
            row.addEventListener('click', () => procesarPreguntaUsuario(item));
            questionsList.appendChild(row);
        });
    }

    // Procesar Pregunta Elegida por el Usuario
    async function procesarPreguntaUsuario(item) {
        modalQuestions.classList.remove('active');
        btnAsk.disabled = true;
        btnGuess.disabled = true;

        const data = await window.gameEngine.usuarioPreguntar(item.id);

        if (data.respuesta === 'si') {
            window.gameAudio.playSuccess();
            dialogueSpeaker.textContent = 'Respuesta de la IA: ¡SÍ!';
            dialogueBar.innerHTML = `Tu pregunta: <em>"${data.pregunta_texto}"</em> &rarr; <strong>¡SÍ, su personaje secreto tiene ese rasgo!</strong> Volteando cartas descartadas...`;
        } else {
            window.gameAudio.playFail();
            dialogueSpeaker.textContent = 'Respuesta de la IA: ¡NO!';
            dialogueBar.innerHTML = `Tu pregunta: <em>"${data.pregunta_texto}"</em> &rarr; <strong>NO, su personaje no posee ese rasgo.</strong> Volteando cartas descartadas...`;
        }

        // Voltear cartas asistido
        data.descartar_personajes.forEach((id, idx) => {
            setTimeout(() => {
                const card = document.getElementById(`card-${id}`);
                if (card && !card.classList.contains('flipped')) {
                    window.gameAudio.playCardFlip();
                    card.classList.add('flipped');
                }
            }, idx * 60);
        });

        // Esperar a que terminen las animaciones y pasar turno a la IA
        setTimeout(() => {
            actualizarEstadoTurno();
        }, Math.max(1200, data.descartar_personajes.length * 60 + 600));
    }

    // Renderizar Opciones de Adivinanza
    function renderGuessModalGrid(tablero) {
        guessGrid.innerHTML = '';
        tablero.forEach(p => {
            const card = document.createElement('div');
            card.className = 'guess-card-item';
            card.innerHTML = `
                <img class="guess-card-img" src="${p.imagen}" alt="${p.nombre}" onerror="this.src='images/banner.png'">
                <div class="guess-card-name">${p.nombre}</div>
            `;
            card.addEventListener('click', () => procesarAdivinanzaUsuario(p.id));
            guessGrid.appendChild(card);
        });
    }

    // Procesar Intento de Adivinanza del Usuario
    async function procesarAdivinanzaUsuario(personajeId) {
        modalGuess.classList.remove('active');
        const data = await window.gameEngine.usuarioAdivinar(personajeId);

        if (data.acierto) {
            window.gameAudio.playVictory();
            mostrarGameOver(true, data.personaje_ia, data.mensaje);
        } else {
            window.gameAudio.playFail();
            dialogueSpeaker.textContent = 'Adivinanza Incorrecta';
            dialogueBar.textContent = `${data.mensaje} Pierdes tu turno y le toca a la máquina.`;
            actualizarEstadoTurno();
        }
    }

    // Fin de Partida (Victoria / Derrota)
    function mostrarGameOver(victoria, personajeIA, mensaje) {
        showScreen('gameOver');
        const icon = document.getElementById('result-icon');
        const title = document.getElementById('result-title');
        const desc = document.getElementById('result-desc');
        const secretImg = document.getElementById('result-secret-img');
        const secretName = document.getElementById('result-secret-name');
        const secretSub = document.getElementById('result-secret-sub');

        if (victoria) {
            icon.textContent = '🏆';
            title.textContent = '¡VICTORIA ABSOLUTA!';
            title.style.color = 'var(--accent-green)';
            desc.textContent = mensaje || '¡Has deducido y adivinado el personaje secreto antes que la IA!';
        } else {
            icon.textContent = '💀';
            title.textContent = 'DERROTA';
            title.style.color = 'var(--accent-red)';
            desc.textContent = mensaje || 'La IA ha descifrado tu personaje secreto antes. ¡Mejor suerte en la próxima!';
        }

        if (personajeIA) {
            secretImg.src = personajeIA.imagen;
            secretName.textContent = personajeIA.nombre;
            secretSub.textContent = personajeIA.subtitulo;
        }
    }

    // Modales de Pregunta y Adivinanza
    btnAsk.addEventListener('click', () => {
        window.gameAudio.playClick();
        modalQuestions.classList.add('active');
    });

    btnGuess.addEventListener('click', () => {
        window.gameAudio.playClick();
        modalGuess.classList.add('active');
    });

    closeQuestionsModal.addEventListener('click', () => modalQuestions.classList.remove('active'));
    closeGuessModal.addEventListener('click', () => modalGuess.classList.remove('active'));

    playAgainBtn.addEventListener('click', () => {
        window.gameAudio.playClick();
        showScreen('menu');
    });
});
