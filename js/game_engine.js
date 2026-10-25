// ====================================================================
// MOTOR DE JUEGO: CLIENTE SWI-PROLOG CON MOTOR EMBEBIDO DE RESPALDO
// ====================================================================

class GameEngine {
    constructor() {
        this.apiBase = 'http://localhost:8002';
        this.useBackend = false; // Se autodetecta al chequear el servidor
        this.gameState = null;

        // Base de conocimiento local (réplica de main.pl para juego 100% autónomo)
        this.kb = this.initKnowledgeBase();
    }

    async checkBackend() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const res = await fetch(`${this.apiBase}/`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                this.useBackend = true;
                return { online: true, data };
            }
        } catch (e) {
            this.useBackend = false;
        }
        return { online: false };
    }

    // Iniciar partida
    async iniciarPartida(modo = 'futbol', dificultad = 'dificil', numCartas = 20) {
        if (this.useBackend) {
            try {
                const res = await fetch(`${this.apiBase}/api/iniciar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modo, dificultad, num_cartas: numCartas })
                });
                if (res.ok) {
                    const data = await res.json();
                    this.gameState = {
                        backend: true,
                        modo,
                        dificultad,
                        tablero: data.tablero,
                        primerTurno: data.primer_turno,
                        preguntas: data.preguntas_disponibles,
                        personajeUsuario: null,
                        personajeIA: null,
                        descartadosUsuario: new Set(),
                        descartadosIA: new Set(),
                        turnoActual: data.primer_turno
                    };
                    return data;
                }
            } catch (err) {
                console.warn('Backend falló, usando motor local:', err);
                this.useBackend = false;
            }
        }

        // MOTOR EMBEBIDO (Local)
        return this.iniciarPartidaLocal(modo, dificultad, numCartas);
    }

    iniciarPartidaLocal(modo, dificultad, numCartas) {
        let candidatos = [];
        if (modo === 'futbol') {
            candidatos = this.kb.personajes.filter(p => p.categoria === 'futbol');
        } else if (modo === 'lol') {
            candidatos = this.kb.personajes.filter(p => p.categoria === 'lol');
        } else {
            // Mixto: equilibrar mitades
            const f = this.shuffle([...this.kb.personajes.filter(p => p.categoria === 'futbol')]);
            const l = this.shuffle([...this.kb.personajes.filter(p => p.categoria === 'lol')]);
            const half = Math.floor(numCartas / 2);
            candidatos = [...f.slice(0, half), ...l.slice(0, numCartas - half)];
        }

        const shuffled = this.shuffle([...candidatos]);
        const tablero = shuffled.slice(0, numCartas);

        // La IA elige su secreto al azar del tablero
        const secretoIA = tablero[Math.floor(Math.random() * tablero.length)];

        // Moneda al azar
        const primerTurno = Math.random() < 0.5 ? 'usuario' : 'ia';

        // Obtener preguntas presentes en los personajes del tablero
        const preguntas = this.extraerPreguntasTablero(tablero);

        this.gameState = {
            backend: false,
            modo,
            dificultad,
            tablero,
            primerTurno,
            preguntas,
            personajeUsuario: null,
            personajeIA: secretoIA,
            descartadosUsuario: new Set(),
            descartadosIA: new Set(),
            iaCandidatos: [...tablero],
            iaHechosSi: new Set(),
            iaHechosNo: new Set(),
            turnoActual: primerTurno
        };

        return {
            ok: true,
            tablero,
            primer_turno: primerTurno,
            preguntas_disponibles: preguntas,
            total_personajes: tablero.length,
            modo,
            dificultad
        };
    }

    // Fijar personaje del usuario
    async fijarPersonajeUsuario(personajeId) {
        this.gameState.personajeUsuario = this.gameState.tablero.find(p => p.id === personajeId);

        if (this.useBackend) {
            try {
                const res = await fetch(`${this.apiBase}/api/fijar_personaje_usuario`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personaje_id: personajeId })
                });
                if (res.ok) return await res.json();
            } catch (e) {
                console.warn('Backend error al fijar personaje:', e);
            }
        }

        return {
            ok: true,
            personaje_usuario: personajeId,
            turno_actual: this.gameState.turnoActual
        };
    }

    // Usuario pregunta un rasgo
    async usuarioPreguntar(rasgoId) {
        if (this.useBackend) {
            try {
                const res = await fetch(`${this.apiBase}/api/usuario_preguntar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rasgo: rasgoId })
                });
                if (res.ok) {
                    const data = await res.json();
                    data.descartar_personajes.forEach(id => this.gameState.descartadosUsuario.add(id));
                    this.gameState.turnoActual = 'ia';
                    return data;
                }
            } catch (e) {
                console.warn('Backend error usuario preguntar:', e);
            }
        }

        // Modo local
        const secretoIA = this.gameState.personajeIA;
        const tiene = secretoIA.rasgos.includes(rasgoId);
        const respuesta = tiene ? 'si' : 'no';

        const descartados = [];
        this.gameState.tablero.forEach(p => {
            const pTiene = p.rasgos.includes(rasgoId);
            if (tiene && !pTiene) {
                descartados.push(p.id);
                this.gameState.descartadosUsuario.add(p.id);
            } else if (!tiene && pTiene) {
                descartados.push(p.id);
                this.gameState.descartadosUsuario.add(p.id);
            }
        });

        const preguntaInfo = this.kb.rasgos[rasgoId];
        this.gameState.turnoActual = 'ia';

        return {
            ok: true,
            respuesta,
            rasgo: rasgoId,
            pregunta_texto: preguntaInfo ? preguntaInfo.pregunta : rasgoId,
            descartar_personajes: descartados,
            siguiente_turno: 'ia'
        };
    }

    // Usuario adivina el personaje secreto de la IA
    async usuarioAdivinar(personajeId) {
        if (this.useBackend) {
            try {
                const res = await fetch(`${this.apiBase}/api/usuario_adivinar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personaje_id: personajeId })
                });
                if (res.ok) return await res.json();
            } catch (e) {
                console.warn('Backend error usuario adivinar:', e);
            }
        }

        // Modo local
        const acierto = this.gameState.personajeIA.id === personajeId;
        if (acierto) {
            this.gameState.turnoActual = 'fin';
            return {
                ok: true,
                acierto: true,
                ganador: 'usuario',
                personaje_ia: this.gameState.personajeIA,
                mensaje: '¡Correcto! Has adivinado el personaje secreto de la IA.'
            };
        } else {
            this.gameState.turnoActual = 'ia';
            return {
                ok: true,
                acierto: false,
                ganador: 'ninguno',
                siguiente_turno: 'ia',
                mensaje: 'Ese no es el personaje secreto de la IA. Pierdes tu turno.'
            };
        }
    }

    // Turno de la IA
    async turnoIA() {
        if (this.useBackend) {
            try {
                const res = await fetch(`${this.apiBase}/api/turno_ia`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    this.gameState.turnoActual = data.siguiente_turno || 'usuario';
                    return data;
                }
            } catch (e) {
                console.warn('Backend error turno IA:', e);
            }
        }

        // Modo local (heurística 50/50 y adivinanza inteligente)
        const candidatos = this.gameState.iaCandidatos;
        const secretoUser = this.gameState.personajeUsuario;

        // Si queda 1 o menos candidatos -> Adivina
        if (candidatos.length <= 1) {
            const adivinado = candidatos[0] || this.gameState.tablero[0];
            const acierto = adivinado.id === secretoUser.id;
            if (acierto) {
                this.gameState.turnoActual = 'fin';
                return {
                    ok: true,
                    tipo_accion: 'adivinanza',
                    acierto: true,
                    personaje_adivinado: adivinado,
                    ganador: 'ia',
                    mensaje: `¡La IA ha adivinado tu personaje (${adivinado.nombre})! La IA gana la partida.`
                };
            } else {
                // Falló su adivinanza
                this.gameState.iaCandidatos = this.gameState.iaCandidatos.filter(c => c.id !== adivinado.id);
                this.gameState.turnoActual = 'usuario';
                return {
                    ok: true,
                    tipo_accion: 'adivinanza',
                    acierto: false,
                    personaje_adivinado: adivinado,
                    ganador: 'ninguno',
                    siguiente_turno: 'usuario',
                    mensaje: `La IA intentó adivinar (${adivinado.nombre}) pero no es tu personaje. ¡Te toca!`
                };
            }
        }

        // La IA selecciona la mejor pregunta
        const rasgoElegido = this.seleccionarRasgoIA(candidatos, this.gameState.dificultad);
        const tieneUsuario = secretoUser.rasgos.includes(rasgoElegido);
        const respuesta = tieneUsuario ? 'si' : 'no';

        if (tieneUsuario) {
            this.gameState.iaHechosSi.add(rasgoElegido);
            this.gameState.iaCandidatos = candidatos.filter(c => c.rasgos.includes(rasgoElegido));
        } else {
            this.gameState.iaHechosNo.add(rasgoElegido);
            this.gameState.iaCandidatos = candidatos.filter(c => !c.rasgos.includes(rasgoElegido));
        }

        const rasgoInfo = this.kb.rasgos[rasgoElegido];
        this.gameState.turnoActual = 'usuario';

        return {
            ok: true,
            tipo_accion: 'pregunta',
            rasgo: rasgoElegido,
            pregunta_texto: rasgoInfo ? rasgoInfo.pregunta : rasgoElegido,
            respuesta_usuario: respuesta,
            ia_candidatos_restantes_count: this.gameState.iaCandidatos.length,
            siguiente_turno: 'usuario',
            mensaje: 'La IA ha preguntado y se ha resuelto automáticamente según tu personaje.'
        };
    }

    seleccionarRasgoIA(candidatos, dificultad) {
        // Rasgos que aún no ha preguntado la IA
        const rasgosCandidatos = new Set();
        candidatos.forEach(c => {
            c.rasgos.forEach(r => {
                if (!this.gameState.iaHechosSi.has(r) && !this.gameState.iaHechosNo.has(r)) {
                    rasgosCandidatos.add(r);
                }
            });
        });

        const listaRasgos = Array.from(rasgosCandidatos);
        if (listaRasgos.length === 0) {
            return candidatos[0].rasgos[0];
        }

        if (dificultad === 'facil') {
            return listaRasgos[Math.floor(Math.random() * listaRasgos.length)];
        }

        // Difícil: Estrategia de división 50/50 (entropía óptima)
        const target = candidatos.length / 2;
        let mejorRasgo = listaRasgos[0];
        let menorDiferencia = 999;

        listaRasgos.forEach(r => {
            const count = candidatos.filter(c => c.rasgos.includes(r)).length;
            const diff = Math.abs(count - target);
            if (diff < menorDiferencia) {
                menorDiferencia = diff;
                mejorRasgo = r;
            }
        });

        return mejorRasgo;
    }

    extraerPreguntasTablero(tablero) {
        const rasgosIds = new Set();
        tablero.forEach(p => p.rasgos.forEach(r => rasgosIds.add(r)));

        const resultado = [];
        rasgosIds.forEach(id => {
            const info = this.kb.rasgos[id];
            if (info) {
                resultado.push({
                    id,
                    categoria: info.categoria,
                    pregunta: info.pregunta,
                    etiqueta: info.etiqueta
                });
            }
        });

        // Ordenar por categoría
        return resultado.sort((a, b) => a.categoria.localeCompare(b.categoria));
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    initKnowledgeBase() {
        return {
            rasgos: {
                es_futbolista: { categoria: 'Mundo', pregunta: '¿Es un jugador de fútbol profesional?', etiqueta: 'Futbolista' },
                es_campeon_lol: { categoria: 'Mundo', pregunta: '¿Es un campeón de League of Legends?', etiqueta: 'Campeón de LoL' },

                // Posición Fútbol
                delantero: { categoria: 'Posición Fútbol', pregunta: '¿Juega de delantero?', etiqueta: 'Delantero' },
                centrocampista: { categoria: 'Posición Fútbol', pregunta: '¿Juega en el mediocampo?', etiqueta: 'Centrocampista' },
                defensa: { categoria: 'Posición Fútbol', pregunta: '¿Es defensa?', etiqueta: 'Defensa' },
                portero: { categoria: 'Posición Fútbol', pregunta: '¿Es portero / arquero?', etiqueta: 'Portero' },

                // Pie Hábil
                pie_zurdo: { categoria: 'Pie Hábil', pregunta: '¿Es zurdo (pie izquierdo)?', etiqueta: 'Zurdo' },
                pie_diestro: { categoria: 'Pie Hábil', pregunta: '¿Es diestro (pie derecho)?', etiqueta: 'Diestro' },

                // Continente Fútbol
                origen_sudamerica: { categoria: 'Continente Fútbol', pregunta: '¿Es de origen sudamericano?', etiqueta: 'Sudamericano' },
                origen_europa: { categoria: 'Continente Fútbol', pregunta: '¿Es de origen europeo?', etiqueta: 'Europeo' },
                origen_africa: { categoria: 'Continente Fútbol', pregunta: '¿Es de origen africano?', etiqueta: 'Africano' },

                // País
                pais_argentina: { categoria: 'País', pregunta: '¿Es de nacionalidad argentina?', etiqueta: 'Argentina' },
                pais_portugal: { categoria: 'País', pregunta: '¿Es de nacionalidad portuguesa?', etiqueta: 'Portugal' },
                pais_francia: { categoria: 'País', pregunta: '¿Es de nacionalidad francesa?', etiqueta: 'Francia' },
                pais_noruega: { categoria: 'País', pregunta: '¿Es de nacionalidad noruega?', etiqueta: 'Noruega' },
                pais_brasil: { categoria: 'País', pregunta: '¿Es de nacionalidad brasileña?', etiqueta: 'Brasil' },
                pais_espana: { categoria: 'País', pregunta: '¿Es de nacionalidad española?', etiqueta: 'España' },
                pais_inglaterra: { categoria: 'País', pregunta: '¿Es de nacionalidad inglesa?', etiqueta: 'Inglaterra' },
                pais_alemania: { categoria: 'País', pregunta: '¿Es de nacionalidad alemana?', etiqueta: 'Alemania' },
                pais_belgica: { categoria: 'País', pregunta: '¿Es de nacionalidad belga?', etiqueta: 'Bélgica' },
                pais_croacia: { categoria: 'País', pregunta: '¿Es de nacionalidad croata?', etiqueta: 'Croacia' },
                pais_polonia: { categoria: 'País', pregunta: '¿Es de nacionalidad polaca?', etiqueta: 'Polonia' },
                pais_egipto: { categoria: 'País', pregunta: '¿Es de nacionalidad egipcia?', etiqueta: 'Egipto' },
                pais_holanda: { categoria: 'País', pregunta: '¿Es de nacionalidad neerlandesa?', etiqueta: 'Países Bajos' },
                pais_uruguay: { categoria: 'País', pregunta: '¿Es de nacionalidad uruguaya?', etiqueta: 'Uruguay' },
                pais_colombia: { categoria: 'País', pregunta: '¿Es de nacionalidad colombiana?', etiqueta: 'Colombia' },

                // Ligas y Clubes
                juega_en_espana: { categoria: 'Liga Fútbol', pregunta: '¿Juega en la liga española (La Liga)?', etiqueta: 'Juega en España' },
                juega_en_inglaterra: { categoria: 'Liga Fútbol', pregunta: '¿Juega en la Premier League inglesa?', etiqueta: 'Juega en Inglaterra' },
                juega_en_alemania: { categoria: 'Liga Fútbol', pregunta: '¿Juega en la Bundesliga alemana?', etiqueta: 'Juega en Alemania' },
                juega_en_arabia: { categoria: 'Liga Fútbol', pregunta: '¿Juega en la liga de Arabia Saudita?', etiqueta: 'Juega en Arabia' },
                juega_en_usa: { categoria: 'Liga Fútbol', pregunta: '¿Juega en la MLS (Estados Unidos)?', etiqueta: 'Juega en USA' },
                en_real_madrid: { categoria: 'Club', pregunta: '¿Juega o es leyenda del Real Madrid?', etiqueta: 'Real Madrid' },
                en_barcelona: { categoria: 'Club', pregunta: '¿Juega o brilló en el FC Barcelona?', etiqueta: 'FC Barcelona' },
                en_manchester_city: { categoria: 'Club', pregunta: '¿Juega en el Manchester City?', etiqueta: 'Manchester City' },
                en_liverpool: { categoria: 'Club', pregunta: '¿Juega en el Liverpool FC?', etiqueta: 'Liverpool' },
                en_bayern: { categoria: 'Club', pregunta: '¿Juega en el Bayern Múnich?', etiqueta: 'Bayern Múnich' },
                en_al_nassr: { categoria: 'Club', pregunta: '¿Juega en el Al-Nassr?', etiqueta: 'Al-Nassr' },
                en_inter_miami: { categoria: 'Club', pregunta: '¿Juega en el Inter Miami?', etiqueta: 'Inter Miami' },
                en_atletico_madrid: { categoria: 'Club', pregunta: '¿Juega en el Atlético de Madrid?', etiqueta: 'Atlético Madrid' },

                // Palmarés y Físico
                ha_ganado_balon_oro: { categoria: 'Palmarés', pregunta: '¿Ha ganado el Balón de Oro?', etiqueta: 'Balón de Oro' },
                ha_ganado_mundial: { categoria: 'Palmarés', pregunta: '¿Ha sido campeón del Mundo?', etiqueta: 'Campeón del Mundo' },
                ha_ganado_champions: { categoria: 'Palmarés', pregunta: '¿Ha ganado la UEFA Champions League?', etiqueta: 'Campeón Champions' },
                tiene_barba: { categoria: 'Apariencia', pregunta: '¿Tiene barba prominente?', etiqueta: 'Tiene barba' },
                pelo_rubio: { categoria: 'Apariencia', pregunta: '¿Tiene el pelo rubio?', etiqueta: 'Pelo rubio' },
                pelo_oscuro: { categoria: 'Apariencia', pregunta: '¿Tiene el pelo oscuro/castaño?', etiqueta: 'Pelo oscuro' },
                estatura_muy_alta: { categoria: 'Apariencia', pregunta: '¿Es muy alto (más de 1.90m)?', etiqueta: 'Muy alto (>1.90m)' },
                estatura_alta: { categoria: 'Apariencia', pregunta: '¿Es de estatura alta (1.85m - 1.90m)?', etiqueta: 'Estatura alta' },
                usa_tatuajes: { categoria: 'Apariencia', pregunta: '¿Lleva tatuajes visibles?', etiqueta: 'Tatuajes' },

                // LoL Roles
                es_asesino: { categoria: 'Rol LoL', pregunta: '¿Tiene rol de Asesino?', etiqueta: 'Asesino' },
                es_mago: { categoria: 'Rol LoL', pregunta: '¿Tiene rol de Mago?', etiqueta: 'Mago' },
                es_tanque: { categoria: 'Rol LoL', pregunta: '¿Tiene rol de Tanque?', etiqueta: 'Tanque' },
                es_tirador: { categoria: 'Rol LoL', pregunta: '¿Tiene rol de Tirador (ADC)?', etiqueta: 'Tirador' },
                es_luchador: { categoria: 'Rol LoL', pregunta: '¿Tiene rol de Luchador?', etiqueta: 'Luchador' },
                es_soporte: { categoria: 'Rol LoL', pregunta: '¿Tiene rol de Soporte?', etiqueta: 'Soporte' },

                // LoL Carriles
                carril_superior_top: { categoria: 'Carril LoL', pregunta: '¿Se juega en carril superior (Top)?', etiqueta: 'Top Lane' },
                jungla: { categoria: 'Carril LoL', pregunta: '¿Se juega en la Jungla?', etiqueta: 'Jungla' },
                carril_central_mid: { categoria: 'Carril LoL', pregunta: '¿Se juega en carril central (Mid)?', etiqueta: 'Mid Lane' },
                carril_inferior_adc: { categoria: 'Carril LoL', pregunta: '¿Se juega como tirador inferior (ADC)?', etiqueta: 'ADC Bot' },
                carril_inferior_soporte: { categoria: 'Carril LoL', pregunta: '¿Se juega como soporte inferior?', etiqueta: 'Soporte Bot' },

                // LoL Regiones
                de_ionia: { categoria: 'Región LoL', pregunta: '¿Pertenece o proviene de Ionia?', etiqueta: 'Ionia' },
                de_demacia: { categoria: 'Región LoL', pregunta: '¿Pertenece a Demacia?', etiqueta: 'Demacia' },
                de_noxus: { categoria: 'Región LoL', pregunta: '¿Pertenece al imperio de Noxus?', etiqueta: 'Noxus' },
                de_freljord: { categoria: 'Región LoL', pregunta: '¿Proviene de las tierras gélidas del Freljord?', etiqueta: 'Freljord' },
                de_zaun: { categoria: 'Región LoL', pregunta: '¿Es de la ciudad de Zaun?', etiqueta: 'Zaun' },
                de_piltover: { categoria: 'Región LoL', pregunta: '¿Es de la ciudad del progreso Piltóver?', etiqueta: 'Piltóver' },
                de_islas_de_la_sombra: { categoria: 'Región LoL', pregunta: '¿Es de las Islas de la Sombra?', etiqueta: 'Islas de la Sombra' },
                de_shurima: { categoria: 'Región LoL', pregunta: '¿Proviene del desierto de Shurima?', etiqueta: 'Shurima' },
                de_bandle: { categoria: 'Región LoL', pregunta: '¿Proviene de la Ciudad de Bandle?', etiqueta: 'Ciudad de Bandle' },
                de_aguasturbias: { categoria: 'Región LoL', pregunta: '¿Es de las costas de Aguasturbias?', etiqueta: 'Aguasturbias' },

                // LoL Recursos y Combate
                usa_mana: { categoria: 'Recurso LoL', pregunta: '¿Utiliza maná como recurso?', etiqueta: 'Usa maná' },
                usa_energia: { categoria: 'Recurso LoL', pregunta: '¿Utiliza energía ninja/marcial como recurso?', etiqueta: 'Usa energía' },
                sin_recurso: { categoria: 'Recurso LoL', pregunta: '¿No gasta maná ni energía (sin coste)?', etiqueta: 'Sin coste/Maná' },
                ataque_cuerpo_a_cuerpo: { categoria: 'Ataque LoL', pregunta: '¿Su ataque básico es cuerpo a cuerpo?', etiqueta: 'Cuerpo a cuerpo' },
                ataque_a_distancia: { categoria: 'Ataque LoL', pregunta: '¿Su ataque básico es a distancia?', etiqueta: 'A distancia' },
                danio_fisico: { categoria: 'Daño LoL', pregunta: '¿Inflige principalmente daño físico (AD)?', etiqueta: 'Daño Físico' },
                danio_magico: { categoria: 'Daño LoL', pregunta: '¿Inflige principalmente daño mágico (AP)?', etiqueta: 'Daño Mágico' },

                // LoL Especie y Visual
                es_humano: { categoria: 'Especie LoL', pregunta: '¿Es de especie humana?', etiqueta: 'Humano' },
                es_yordle: { categoria: 'Especie LoL', pregunta: '¿Es de raza Yordle?', etiqueta: 'Yordle' },
                es_vastoia: { categoria: 'Especie LoL', pregunta: '¿Es de raza Vastoia (rasgos animales)?', etiqueta: 'Vastoia' },
                es_no_muerto: { categoria: 'Especie LoL', pregunta: '¿Es un espectro o no-muerto?', etiqueta: 'No-muerto' },
                es_monstruo_o_criatura: { categoria: 'Especie LoL', pregunta: '¿Es un monstruo, criatura o gólem?', etiqueta: 'Monstruo / Gólem' },
                usa_espada: { categoria: 'Armas LoL', pregunta: '¿Empuña una espada o sable?', etiqueta: 'Usa espada' },
                usa_arma_de_fuego: { categoria: 'Armas LoL', pregunta: '¿Usa pistolas, rifles o armas de fuego?', etiqueta: 'Arma de fuego' },
                tiene_mascara_o_casco: { categoria: 'Visual LoL', pregunta: '¿Lleva máscara o casco cubriendo su rostro?', etiqueta: 'Máscara o casco' },
                vuela_o_flota: { categoria: 'Visual LoL', pregunta: '¿Vuela, levita o flota?', etiqueta: 'Vuela o flota' },
                genero_masculino: { categoria: 'Género', pregunta: '¿Es de género masculino?', etiqueta: 'Masculino' },
                genero_femenino: { categoria: 'Género', pregunta: '¿Es de género femenino?', etiqueta: 'Femenino' },
                sin_genero_o_monstruo: { categoria: 'Género', pregunta: '¿No tiene género humanoide definido?', etiqueta: 'Sin género' }
            },

            personajes: [
                // FUTBOLISTAS (24)
                { id: 'lionel_messi', categoria: 'futbol', nombre: 'Lionel Messi', subtitulo: 'Inter Miami / Argentina', imagen: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_zurdo', 'origen_sudamerica', 'pais_argentina', 'juega_en_usa', 'en_inter_miami', 'ha_ganado_balon_oro', 'ha_ganado_mundial', 'ha_ganado_champions', 'tiene_barba', 'pelo_oscuro', 'usa_tatuajes'] },
                { id: 'cristiano_ronaldo', categoria: 'futbol', nombre: 'Cristiano Ronaldo', subtitulo: 'Al-Nassr / Portugal', imagen: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_diestro', 'origen_europa', 'pais_portugal', 'juega_en_arabia', 'en_al_nassr', 'ha_ganado_balon_oro', 'ha_ganado_champions', 'pelo_oscuro', 'estatura_alta'] },
                { id: 'kylian_mbappe', categoria: 'futbol', nombre: 'Kylian Mbappé', subtitulo: 'Real Madrid / Francia', imagen: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_diestro', 'origen_europa', 'pais_francia', 'juega_en_espana', 'en_real_madrid', 'ha_ganado_mundial', 'pelo_oscuro'] },
                { id: 'erling_haaland', categoria: 'futbol', nombre: 'Erling Haaland', subtitulo: 'Manchester City / Noruega', imagen: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_zurdo', 'origen_europa', 'pais_noruega', 'juega_en_inglaterra', 'en_manchester_city', 'ha_ganado_champions', 'pelo_rubio', 'estatura_muy_alta'] },
                { id: 'vinicius_junior', categoria: 'futbol', nombre: 'Vinícius Júnior', subtitulo: 'Real Madrid / Brasil', imagen: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_diestro', 'origen_sudamerica', 'pais_brasil', 'juega_en_espana', 'en_real_madrid', 'ha_ganado_champions', 'pelo_oscuro', 'usa_tatuajes'] },
                { id: 'luka_modric', categoria: 'futbol', nombre: 'Luka Modrić', subtitulo: 'Real Madrid / Croacia', imagen: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'centrocampista', 'pie_diestro', 'origen_europa', 'pais_croacia', 'juega_en_espana', 'en_real_madrid', 'ha_ganado_balon_oro', 'ha_ganado_champions', 'pelo_rubio'] },
                { id: 'thibaut_courtois', categoria: 'futbol', nombre: 'Thibaut Courtois', subtitulo: 'Real Madrid / Bélgica', imagen: 'https://images.unsplash.com/photo-1628891435222-065925dcb365?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'portero', 'pie_zurdo', 'origen_europa', 'pais_belgica', 'juega_en_espana', 'en_real_madrid', 'ha_ganado_champions', 'pelo_oscuro', 'estatura_muy_alta'] },
                { id: 'jude_bellingham', categoria: 'futbol', nombre: 'Jude Bellingham', subtitulo: 'Real Madrid / Inglaterra', imagen: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'centrocampista', 'pie_diestro', 'origen_europa', 'pais_inglaterra', 'juega_en_espana', 'en_real_madrid', 'ha_ganado_champions', 'pelo_oscuro', 'estatura_alta'] },
                { id: 'kevin_de_bruyne', categoria: 'futbol', nombre: 'Kevin De Bruyne', subtitulo: 'Manchester City / Bélgica', imagen: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'centrocampista', 'pie_diestro', 'origen_europa', 'pais_belgica', 'juega_en_inglaterra', 'en_manchester_city', 'ha_ganado_champions', 'pelo_rubio'] },
                { id: 'robert_lewandowski', categoria: 'futbol', nombre: 'Robert Lewandowski', subtitulo: 'FC Barcelona / Polonia', imagen: 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_diestro', 'origen_europa', 'pais_polonia', 'juega_en_espana', 'en_barcelona', 'ha_ganado_champions', 'pelo_oscuro', 'estatura_alta'] },
                { id: 'mohamed_salah', categoria: 'futbol', nombre: 'Mohamed Salah', subtitulo: 'Liverpool / Egipto', imagen: 'https://images.unsplash.com/photo-1517747614396-d21a78b850e8?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_zurdo', 'origen_africa', 'pais_egipto', 'juega_en_inglaterra', 'en_liverpool', 'ha_ganado_champions', 'tiene_barba', 'pelo_oscuro'] },
                { id: 'neymar_jr', categoria: 'futbol', nombre: 'Neymar Jr', subtitulo: 'Al-Hilal / Brasil', imagen: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_diestro', 'origen_sudamerica', 'pais_brasil', 'juega_en_arabia', 'en_al_hilal', 'ha_ganado_champions', 'pelo_oscuro', 'usa_tatuajes'] },
                { id: 'lamine_yamal', categoria: 'futbol', nombre: 'Lamine Yamal', subtitulo: 'FC Barcelona / España', imagen: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_zurdo', 'origen_europa', 'pais_espana', 'juega_en_espana', 'en_barcelona', 'pelo_oscuro'] },
                { id: 'toni_kroos', categoria: 'futbol', nombre: 'Toni Kroos', subtitulo: 'Leyenda Alemania / Real Madrid', imagen: 'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'centrocampista', 'pie_diestro', 'origen_europa', 'pais_alemania', 'ha_ganado_mundial', 'ha_ganado_champions', 'pelo_rubio', 'usa_tatuajes'] },
                { id: 'virgil_van_dijk', categoria: 'futbol', nombre: 'Virgil van Dijk', subtitulo: 'Liverpool / Países Bajos', imagen: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'defensa', 'pie_diestro', 'origen_europa', 'pais_holanda', 'juega_en_inglaterra', 'en_liverpool', 'ha_ganado_champions', 'tiene_barba', 'pelo_oscuro', 'estatura_muy_alta', 'usa_tatuajes'] },
                { id: 'emiliano_martinez', categoria: 'futbol', nombre: 'Emiliano "Dibu" Martínez', subtitulo: 'Aston Villa / Argentina', imagen: 'https://images.unsplash.com/photo-1628891435222-065925dcb365?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'portero', 'pie_diestro', 'origen_sudamerica', 'pais_argentina', 'juega_en_inglaterra', 'en_aston_villa', 'ha_ganado_mundial', 'pelo_oscuro', 'estatura_muy_alta'] },
                { id: 'antoine_griezmann', categoria: 'futbol', nombre: 'Antoine Griezmann', subtitulo: 'Atlético de Madrid / Francia', imagen: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_zurdo', 'origen_europa', 'pais_francia', 'juega_en_espana', 'en_atletico_madrid', 'ha_ganado_mundial', 'pelo_rubio', 'usa_tatuajes'] },
                { id: 'rodrigo_hernandez', categoria: 'futbol', nombre: 'Rodri Hernández', subtitulo: 'Manchester City / España', imagen: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'centrocampista', 'pie_diestro', 'origen_europa', 'pais_espana', 'juega_en_inglaterra', 'en_manchester_city', 'ha_ganado_balon_oro', 'ha_ganado_champions', 'pelo_oscuro', 'estatura_alta'] },
                { id: 'pedri', categoria: 'futbol', nombre: 'Pedri González', subtitulo: 'FC Barcelona / España', imagen: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'centrocampista', 'pie_diestro', 'origen_europa', 'pais_espana', 'juega_en_espana', 'en_barcelona', 'pelo_oscuro'] },
                { id: 'federico_valverde', categoria: 'futbol', nombre: 'Federico Valverde', subtitulo: 'Real Madrid / Uruguay', imagen: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'centrocampista', 'pie_diestro', 'origen_sudamerica', 'pais_uruguay', 'juega_en_espana', 'en_real_madrid', 'ha_ganado_champions', 'pelo_oscuro', 'usa_tatuajes'] },
                { id: 'manuel_neuer', categoria: 'futbol', nombre: 'Manuel Neuer', subtitulo: 'Bayern Múnich / Alemania', imagen: 'https://images.unsplash.com/photo-1628891435222-065925dcb365?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'portero', 'pie_diestro', 'origen_europa', 'pais_alemania', 'juega_en_alemania', 'en_bayern', 'ha_ganado_mundial', 'ha_ganado_champions', 'pelo_rubio', 'estatura_muy_alta'] },
                { id: 'harry_kane', categoria: 'futbol', nombre: 'Harry Kane', subtitulo: 'Bayern Múnich / Inglaterra', imagen: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_diestro', 'origen_europa', 'pais_inglaterra', 'juega_en_alemania', 'en_bayern', 'tiene_barba', 'pelo_rubio', 'estatura_alta'] },
                { id: 'sergio_ramos', categoria: 'futbol', nombre: 'Sergio Ramos', subtitulo: 'Leyenda España / Real Madrid', imagen: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'defensa', 'pie_diestro', 'origen_europa', 'pais_espana', 'ha_ganado_mundial', 'ha_ganado_champions', 'tiene_barba', 'pelo_oscuro', 'usa_tatuajes', 'estatura_alta'] },
                { id: 'luis_diaz', categoria: 'futbol', nombre: 'Luis Díaz', subtitulo: 'Liverpool / Colombia', imagen: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&auto=format&fit=crop&q=80', rasgos: ['es_futbolista', 'delantero', 'pie_diestro', 'origen_sudamerica', 'pais_colombia', 'juega_en_inglaterra', 'en_liverpool', 'pelo_oscuro', 'tiene_barba', 'usa_tatuajes'] },

                // LEAGUE OF LEGENDS (24)
                { id: 'yasuo', categoria: 'lol', nombre: 'Yasuo', subtitulo: 'El Imperdonable / Ionia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yasuo_0.jpg', rasgos: ['es_campeon_lol', 'es_luchador', 'es_asesino', 'carril_central_mid', 'carril_superior_top', 'de_ionia', 'sin_recurso', 'ataque_cuerpo_a_cuerpo', 'danio_fisico', 'es_humano', 'usa_espada', 'genero_masculino'] },
                { id: 'ahri', categoria: 'lol', nombre: 'Ahri', subtitulo: 'La Zorra de Nueve Colas / Ionia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg', rasgos: ['es_campeon_lol', 'es_mago', 'es_asesino', 'carril_central_mid', 'de_ionia', 'usa_mana', 'ataque_a_distancia', 'danio_magico', 'es_vastoia', 'genero_femenino'] },
                { id: 'jinx', categoria: 'lol', nombre: 'Jinx', subtitulo: 'La Bala Perdida / Zaun', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg', rasgos: ['es_campeon_lol', 'es_tirador', 'carril_inferior_adc', 'de_zaun', 'usa_mana', 'ataque_a_distancia', 'danio_fisico', 'es_humano', 'usa_arma_de_fuego', 'genero_femenino'] },
                { id: 'garen', categoria: 'lol', nombre: 'Garen', subtitulo: 'El Poder de Demacia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Garen_0.jpg', rasgos: ['es_campeon_lol', 'es_luchador', 'es_tanque', 'carril_superior_top', 'de_demacia', 'sin_recurso', 'ataque_cuerpo_a_cuerpo', 'danio_fisico', 'es_humano', 'usa_espada', 'genero_masculino'] },
                { id: 'lee_sin', categoria: 'lol', nombre: 'Lee Sin', subtitulo: 'El Monje Ciego / Ionia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_0.jpg', rasgos: ['es_campeon_lol', 'es_luchador', 'es_asesino', 'jungla', 'de_ionia', 'usa_energia', 'ataque_cuerpo_a_cuerpo', 'danio_fisico', 'es_humano', 'genero_masculino'] },
                { id: 'lux', categoria: 'lol', nombre: 'Lux', subtitulo: 'La Dama Luminosa / Demacia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Lux_0.jpg', rasgos: ['es_campeon_lol', 'es_mago', 'es_soporte', 'carril_central_mid', 'carril_inferior_soporte', 'de_demacia', 'usa_mana', 'ataque_a_distancia', 'danio_magico', 'es_humano', 'genero_femenino'] },
                { id: 'zed', categoria: 'lol', nombre: 'Zed', subtitulo: 'El Maestro de las Sombras / Ionia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Zed_0.jpg', rasgos: ['es_campeon_lol', 'es_asesino', 'carril_central_mid', 'de_ionia', 'usa_energia', 'ataque_cuerpo_a_cuerpo', 'danio_fisico', 'es_humano', 'tiene_mascara_o_casco', 'genero_masculino'] },
                { id: 'thresh', categoria: 'lol', nombre: 'Thresh', subtitulo: 'El Carcelero Implacable / Islas Sombra', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Thresh_0.jpg', rasgos: ['es_campeon_lol', 'es_soporte', 'es_tanque', 'carril_inferior_soporte', 'de_islas_de_la_sombra', 'usa_mana', 'ataque_a_distancia', 'danio_magico', 'es_no_muerto', 'genero_masculino'] },
                { id: 'teemo', categoria: 'lol', nombre: 'Teemo', subtitulo: 'El Explorador Veloz / Bandle', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Teemo_0.jpg', rasgos: ['es_campeon_lol', 'es_tirador', 'es_mago', 'carril_superior_top', 'de_bandle', 'usa_mana', 'ataque_a_distancia', 'danio_magico', 'es_yordle', 'tiene_mascara_o_casco', 'genero_masculino'] },
                { id: 'darius', categoria: 'lol', nombre: 'Darius', subtitulo: 'La Mano de Noxus', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Darius_0.jpg', rasgos: ['es_campeon_lol', 'es_luchador', 'carril_superior_top', 'de_noxus', 'usa_mana', 'ataque_cuerpo_a_cuerpo', 'danio_fisico', 'es_humano', 'genero_masculino'] },
                { id: 'akali', categoria: 'lol', nombre: 'Akali', subtitulo: 'La Asesina Furtiva / Ionia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Akali_0.jpg', rasgos: ['es_campeon_lol', 'es_asesino', 'carril_central_mid', 'carril_superior_top', 'de_ionia', 'usa_energia', 'ataque_cuerpo_a_cuerpo', 'danio_magico', 'es_humano', 'tiene_mascara_o_casco', 'genero_femenino'] },
                { id: 'viego', categoria: 'lol', nombre: 'Viego', subtitulo: 'El Rey Arruinado / Islas Sombra', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Viego_0.jpg', rasgos: ['es_campeon_lol', 'es_asesino', 'es_luchador', 'jungla', 'de_islas_de_la_sombra', 'sin_recurso', 'ataque_cuerpo_a_cuerpo', 'danio_fisico', 'es_no_muerto', 'usa_espada', 'genero_masculino'] },
                { id: 'janna', categoria: 'lol', nombre: 'Janna', subtitulo: 'La Furia de la Tormenta / Zaun', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Janna_0.jpg', rasgos: ['es_campeon_lol', 'es_soporte', 'es_mago', 'carril_inferior_soporte', 'de_zaun', 'usa_mana', 'ataque_a_distancia', 'danio_magico', 'vuela_o_flota', 'genero_femenino'] },
                { id: 'katarina', categoria: 'lol', nombre: 'Katarina', subtitulo: 'La Cuchilla Siniestra / Noxus', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Katarina_0.jpg', rasgos: ['es_campeon_lol', 'es_asesino', 'carril_central_mid', 'de_noxus', 'sin_recurso', 'ataque_cuerpo_a_cuerpo', 'danio_magico', 'es_humano', 'genero_femenino'] },
                { id: 'ashe', categoria: 'lol', nombre: 'Ashe', subtitulo: 'La Arquera de Hielo / Freljord', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ashe_0.jpg', rasgos: ['es_campeon_lol', 'es_tirador', 'carril_inferior_adc', 'de_freljord', 'usa_mana', 'ataque_a_distancia', 'danio_fisico', 'es_humano', 'genero_femenino'] },
                { id: 'caitlyn', categoria: 'lol', nombre: 'Caitlyn', subtitulo: 'La Sheriff de Piltóver', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Caitlyn_0.jpg', rasgos: ['es_campeon_lol', 'es_tirador', 'carril_inferior_adc', 'de_piltover', 'usa_mana', 'ataque_a_distancia', 'danio_fisico', 'es_humano', 'usa_arma_de_fuego', 'genero_femenino'] },
                { id: 'miss_fortune', categoria: 'lol', nombre: 'Miss Fortune', subtitulo: 'La Cazarrecompensas / Aguasturbias', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/MissFortune_0.jpg', rasgos: ['es_campeon_lol', 'es_tirador', 'carril_inferior_adc', 'de_aguasturbias', 'usa_mana', 'ataque_a_distancia', 'danio_fisico', 'es_humano', 'usa_arma_de_fuego', 'genero_femenino'] },
                { id: 'mordekaiser', categoria: 'lol', nombre: 'Mordekaiser', subtitulo: 'El Renacido de Hierro / Noxus', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Mordekaiser_0.jpg', rasgos: ['es_campeon_lol', 'es_luchador', 'carril_superior_top', 'de_noxus', 'sin_recurso', 'ataque_cuerpo_a_cuerpo', 'danio_magico', 'es_no_muerto', 'tiene_mascara_o_casco', 'genero_masculino'] },
                { id: 'malphite', categoria: 'lol', nombre: 'Malphite', subtitulo: 'El Fragmento del Monolito / Shurima', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Malphite_0.jpg', rasgos: ['es_campeon_lol', 'es_tanque', 'carril_superior_top', 'de_shurima', 'usa_mana', 'ataque_cuerpo_a_cuerpo', 'danio_magico', 'es_monstruo_o_criatura', 'sin_genero_o_monstruo'] },
                { id: 'blitzcrank', categoria: 'lol', nombre: 'Blitzcrank', subtitulo: 'El Gran Gólem de Vapor / Zaun', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Blitzcrank_0.jpg', rasgos: ['es_campeon_lol', 'es_tanque', 'es_soporte', 'carril_inferior_soporte', 'de_zaun', 'usa_mana', 'ataque_cuerpo_a_cuerpo', 'danio_magico', 'es_monstruo_o_criatura', 'sin_genero_o_monstruo'] },
                { id: 'lucian', categoria: 'lol', nombre: 'Lucian', subtitulo: 'El Purificador / Demacia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Lucian_0.jpg', rasgos: ['es_campeon_lol', 'es_tirador', 'carril_inferior_adc', 'de_demacia', 'usa_mana', 'ataque_a_distancia', 'danio_fisico', 'es_humano', 'usa_arma_de_fuego', 'genero_masculino'] },
                { id: 'sett', categoria: 'lol', nombre: 'Sett', subtitulo: 'El Jefe / Ionia', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Sett_0.jpg', rasgos: ['es_campeon_lol', 'es_luchador', 'carril_superior_top', 'de_ionia', 'sin_recurso', 'ataque_cuerpo_a_cuerpo', 'danio_fisico', 'es_vastoia', 'genero_masculino'] },
                { id: 'braum', categoria: 'lol', nombre: 'Braum', subtitulo: 'El Corazón del Freljord', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Braum_0.jpg', rasgos: ['es_campeon_lol', 'es_soporte', 'es_tanque', 'carril_inferior_soporte', 'de_freljord', 'usa_mana', 'ataque_cuerpo_a_cuerpo', 'danio_magico', 'es_humano', 'genero_masculino'] },
                { id: 'veigar', categoria: 'lol', nombre: 'Veigar', subtitulo: 'El Pequeño Maestro del Mal / Bandle', imagen: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Veigar_0.jpg', rasgos: ['es_campeon_lol', 'es_mago', 'carril_central_mid', 'de_bandle', 'usa_mana', 'ataque_a_distancia', 'danio_magico', 'es_yordle', 'tiene_mascara_o_casco', 'genero_masculino'] }
            ]
        };
    }
}

window.gameEngine = new GameEngine();
