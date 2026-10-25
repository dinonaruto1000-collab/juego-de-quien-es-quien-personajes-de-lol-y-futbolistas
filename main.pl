%% ====================================================================
%% QUIEN ES QUIEN: FUTBOL Y LEAGUE OF LEGENDS
%% Servidor SWI-Prolog con Motor de Inferencia y API REST
%% ====================================================================

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_client)).
:- use_module(library(http/http_error)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_cors)).
:- use_module(library(random)).
:- use_module(library(lists)).

%% Habilitar CORS para peticiones desde el navegador
:- set_setting(http:cors, [*]).

%% ====================================================================
%% PREDICADOS DINAMICOS (ESTADO DE LA PARTIDA)
%% ====================================================================
:- dynamic
    partida_activa/0,
    modo_categoria/1,         % futbol, lol, mixto
    dificultad_ia/1,          % facil, dificil
    tablero_actual/1,         % Lista de IDs de personajes en juego
    personaje_secreto_ia/1,   % ID del personaje secreto de la máquina
    personaje_secreto_user/1, % ID del personaje secreto del jugador
    turno_actual/1,           % usuario, ia, fin
    ganador_partida/1,        % usuario, ia, ninguno
    ia_hecho_si/1,            % Rasgos que la IA sabe que el usuario TIENE
    ia_hecho_no/1,            % Rasgos que la IA sabe que el usuario NO TIENE
    ia_candidatos/1.          % Lista de personajes que la IA aún considera

%% ====================================================================
%% BASE DE CONOCIMIENTO: FUTBOLISTAS
%% ====================================================================
personaje(lionel_messi, futbol, [
    nombre('Lionel Messi'),
    subtitulo('Inter Miami / Argentina'),
    imagen('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_zurdo, origen_sudamerica, pais_argentina,
        juega_en_usa, en_inter_miami, ha_ganado_balon_oro, ha_ganado_mundial,
        ha_ganado_champions, tiene_barba, pelo_oscuro, usa_tatuajes
    ])
]).

personaje(cristiano_ronaldo, futbol, [
    nombre('Cristiano Ronaldo'),
    subtitulo('Al-Nassr / Portugal'),
    imagen('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_diestro, origen_europa, pais_portugal,
        juega_en_arabia, en_al_nassr, ha_ganado_balon_oro, ha_ganado_champions,
        pelo_oscuro, estatura_alta
    ])
]).

personaje(kylian_mbappe, futbol, [
    nombre('Kylian Mbappé'),
    subtitulo('Real Madrid / Francia'),
    imagen('https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_diestro, origen_europa, pais_francia,
        juega_en_espana, en_real_madrid, ha_ganado_mundial, pelo_oscuro
    ])
]).

personaje(erling_haaland, futbol, [
    nombre('Erling Haaland'),
    subtitulo('Manchester City / Noruega'),
    imagen('https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_zurdo, origen_europa, pais_noruega,
        juega_en_inglaterra, en_manchester_city, ha_ganado_champions, pelo_rubio,
        estatura_muy_alta
    ])
]).

personaje(vinicius_junior, futbol, [
    nombre('Vinícius Júnior'),
    subtitulo('Real Madrid / Brasil'),
    imagen('https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_diestro, origen_sudamerica, pais_brasil,
        juega_en_espana, en_real_madrid, ha_ganado_champions, pelo_oscuro,
        usa_tatuajes
    ])
]).

personaje(luka_modric, futbol, [
    nombre('Luka Modrić'),
    subtitulo('Real Madrid / Croacia'),
    imagen('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, centrocampista, pie_diestro, origen_europa, pais_croacia,
        juega_en_espana, en_real_madrid, ha_ganado_balon_oro, ha_ganado_champions,
        pelo_rubio
    ])
]).

personaje(thibaut_courtois, futbol, [
    nombre('Thibaut Courtois'),
    subtitulo('Real Madrid / Bélgica'),
    imagen('https://images.unsplash.com/photo-1628891435222-065925dcb365?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, portero, pie_zurdo, origen_europa, pais_belgica,
        juega_en_espana, en_real_madrid, ha_ganado_champions, pelo_oscuro,
        estatura_muy_alta
    ])
]).

personaje(jude_bellingham, futbol, [
    nombre('Jude Bellingham'),
    subtitulo('Real Madrid / Inglaterra'),
    imagen('https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, centrocampista, pie_diestro, origen_europa, pais_inglaterra,
        juega_en_espana, en_real_madrid, ha_ganado_champions, pelo_oscuro,
        estatura_alta
    ])
]).

personaje(kevin_de_bruyne, futbol, [
    nombre('Kevin De Bruyne'),
    subtitulo('Manchester City / Bélgica'),
    imagen('https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, centrocampista, pie_diestro, origen_europa, pais_belgica,
        juega_en_inglaterra, en_manchester_city, ha_ganado_champions, pelo_rubio
    ])
]).

personaje(robert_lewandowski, futbol, [
    nombre('Robert Lewandowski'),
    subtitulo('FC Barcelona / Polonia'),
    imagen('https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_diestro, origen_europa, pais_polonia,
        juega_en_espana, en_barcelona, ha_ganado_champions, pelo_oscuro,
        estatura_alta
    ])
]).

personaje(mohamed_salah, futbol, [
    nombre('Mohamed Salah'),
    subtitulo('Liverpool / Egipto'),
    imagen('https://images.unsplash.com/photo-1517747614396-d21a78b850e8?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_zurdo, origen_africa, pais_egipto,
        juega_en_inglaterra, en_liverpool, ha_ganado_champions, tiene_barba,
        pelo_oscuro
    ])
]).

personaje(neymar_jr, futbol, [
    nombre('Neymar Jr'),
    subtitulo('Al-Hilal / Brasil'),
    imagen('https://images.unsplash.com/photo-1511886929837-354d827aae26?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_diestro, origen_sudamerica, pais_brasil,
        juega_en_arabia, en_al_hilal, ha_ganado_champions, pelo_oscuro,
        usa_tatuajes
    ])
]).

personaje(lamine_yamal, futbol, [
    nombre('Lamine Yamal'),
    subtitulo('FC Barcelona / España'),
    imagen('https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_zurdo, origen_europa, pais_espana,
        juega_en_espana, en_barcelona, pelo_oscuro
    ])
]).

personaje(toni_kroos, futbol, [
    nombre('Toni Kroos'),
    subtitulo('Leyenda Alemania / Real Madrid'),
    imagen('https://images.unsplash.com/photo-1521412644187-c49fa049e84d?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, centrocampista, pie_diestro, origen_europa, pais_alemania,
        ha_ganado_mundial, ha_ganado_champions, pelo_rubio, usa_tatuajes
    ])
]).

personaje(virgil_van_dijk, futbol, [
    nombre('Virgil van Dijk'),
    subtitulo('Liverpool / Países Bajos'),
    imagen('https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, defensa, pie_diestro, origen_europa, pais_holanda,
        juega_en_inglaterra, en_liverpool, ha_ganado_champions, tiene_barba,
        pelo_oscuro, estatura_muy_alta, usa_tatuajes
    ])
]).

personaje(emiliano_martinez, futbol, [
    nombre('Emiliano "Dibu" Martínez'),
    subtitulo('Aston Villa / Argentina'),
    imagen('https://images.unsplash.com/photo-1628891435222-065925dcb365?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, portero, pie_diestro, origen_sudamerica, pais_argentina,
        juega_en_inglaterra, en_aston_villa, ha_ganado_mundial, pelo_oscuro,
        estatura_muy_alta
    ])
]).

personaje(antoine_griezmann, futbol, [
    nombre('Antoine Griezmann'),
    subtitulo('Atlético de Madrid / Francia'),
    imagen('https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_zurdo, origen_europa, pais_francia,
        juega_en_espana, en_atletico_madrid, ha_ganado_mundial, pelo_rubio,
        usa_tatuajes
    ])
]).

personaje(rodrigo_hernandez, futbol, [
    nombre('Rodri Hernández'),
    subtitulo('Manchester City / España'),
    imagen('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, centrocampista, pie_diestro, origen_europa, pais_espana,
        juega_en_inglaterra, en_manchester_city, ha_ganado_balon_oro,
        ha_ganado_champions, pelo_oscuro, estatura_alta
    ])
]).

personaje(pedri, futbol, [
    nombre('Pedri González'),
    subtitulo('FC Barcelona / España'),
    imagen('https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, centrocampista, pie_diestro, origen_europa, pais_espana,
        juega_en_espana, en_barcelona, pelo_oscuro
    ])
]).

personaje(federico_valverde, futbol, [
    nombre('Federico Valverde'),
    subtitulo('Real Madrid / Uruguay'),
    imagen('https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, centrocampista, pie_diestro, origen_sudamerica, pais_uruguay,
        juega_en_espana, en_real_madrid, ha_ganado_champions, pelo_oscuro,
        usa_tatuajes
    ])
]).

personaje(manuel_neuer, futbol, [
    nombre('Manuel Neuer'),
    subtitulo('Bayern Múnich / Alemania'),
    imagen('https://images.unsplash.com/photo-1628891435222-065925dcb365?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, portero, pie_diestro, origen_europa, pais_alemania,
        juega_en_alemania, en_bayern, ha_ganado_mundial, ha_ganado_champions,
        pelo_rubio, estatura_muy_alta
    ])
]).

personaje(harry_kane, futbol, [
    nombre('Harry Kane'),
    subtitulo('Bayern Múnich / Inglaterra'),
    imagen('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_diestro, origen_europa, pais_inglaterra,
        juega_en_alemania, en_bayern, tiene_barba, pelo_rubio, estatura_alta
    ])
]).

personaje(sergio_ramos, futbol, [
    nombre('Sergio Ramos'),
    subtitulo('Leyenda España / Real Madrid'),
    imagen('https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, defensa, pie_diestro, origen_europa, pais_espana,
        ha_ganado_mundial, ha_ganado_champions, tiene_barba, pelo_oscuro,
        usa_tatuajes, estatura_alta
    ])
]).

personaje(luis_diaz, futbol, [
    nombre('Luis Díaz'),
    subtitulo('Liverpool / Colombia'),
    imagen('https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&auto=format&fit=crop&q=80'),
    rasgos([
        es_futbolista, delantero, pie_diestro, origen_sudamerica, pais_colombia,
        juega_en_inglaterra, en_liverpool, pelo_oscuro, tiene_barba, usa_tatuajes
    ])
]).

%% ====================================================================
%% BASE DE CONOCIMIENTO: LEAGUE OF LEGENDS
%% ====================================================================
personaje(yasuo, lol, [
    nombre('Yasuo'),
    subtitulo('El Imperdonable / Ionia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yasuo_0.jpg'),
    rasgos([
        es_campeon_lol, es_luchador, es_asesino, carril_central_mid, carril_superior_top,
        de_ionia, sin_recurso, ataque_cuerpo_a_cuerpo, danio_fisico, es_humano,
        usa_espada, genero_masculino
    ])
]).

personaje(ahri, lol, [
    nombre('Ahri'),
    subtitulo('La Zorra de Nueve Colas / Ionia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg'),
    rasgos([
        es_campeon_lol, es_mago, es_asesino, carril_central_mid, de_ionia,
        usa_mana, ataque_a_distancia, danio_magico, es_vastoia, genero_femenino
    ])
]).

personaje(jinx, lol, [
    nombre('Jinx'),
    subtitulo('La Bala Perdida / Zaun'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg'),
    rasgos([
        es_campeon_lol, es_tirador, carril_inferior_adc, de_zaun, usa_mana,
        ataque_a_distancia, danio_fisico, es_humano, usa_arma_de_fuego,
        genero_femenino
    ])
]).

personaje(garen, lol, [
    nombre('Garen'),
    subtitulo('El Poder de Demacia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Garen_0.jpg'),
    rasgos([
        es_campeon_lol, es_luchador, es_tanque, carril_superior_top, de_demacia,
        sin_recurso, ataque_cuerpo_a_cuerpo, danio_fisico, es_humano, usa_espada,
        genero_masculino
    ])
]).

personaje(lee_sin, lol, [
    nombre('Lee Sin'),
    subtitulo('El Monje Ciego / Ionia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_0.jpg'),
    rasgos([
        es_campeon_lol, es_luchador, es_asesino, jungla, de_ionia, usa_energia,
        ataque_cuerpo_a_cuerpo, danio_fisico, es_humano, genero_masculino
    ])
]).

personaje(lux, lol, [
    nombre('Lux'),
    subtitulo('La Dama Luminosa / Demacia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Lux_0.jpg'),
    rasgos([
        es_campeon_lol, es_mago, es_soporte, carril_central_mid, carril_inferior_soporte,
        de_demacia, usa_mana, ataque_a_distancia, danio_magico, es_humano,
        genero_femenino
    ])
]).

personaje(zed, lol, [
    nombre('Zed'),
    subtitulo('El Maestro de las Sombras / Ionia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Zed_0.jpg'),
    rasgos([
        es_campeon_lol, es_asesino, carril_central_mid, de_ionia, usa_energia,
        ataque_cuerpo_a_cuerpo, danio_fisico, es_humano, tiene_mascara_o_casco,
        genero_masculino
    ])
]).

personaje(thresh, lol, [
    nombre('Thresh'),
    subtitulo('El Carcelero Implacable / Islas de la Sombra'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Thresh_0.jpg'),
    rasgos([
        es_campeon_lol, es_soporte, es_tanque, carril_inferior_soporte,
        de_islas_de_la_sombra, usa_mana, ataque_a_distancia, danio_magico,
        es_no_muerto, genero_masculino
    ])
]).

personaje(teemo, lol, [
    nombre('Teemo'),
    subtitulo('El Explorador Veloz / Bandle'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Teemo_0.jpg'),
    rasgos([
        es_campeon_lol, es_tirador, es_mago, carril_superior_top, de_bandle,
        usa_mana, ataque_a_distancia, danio_magico, es_yordle, tiene_mascara_o_casco,
        genero_masculino
    ])
]).

personaje(darius, lol, [
    nombre('Darius'),
    subtitulo('La Mano de Noxus'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Darius_0.jpg'),
    rasgos([
        es_campeon_lol, es_luchador, carril_superior_top, de_noxus, usa_mana,
        ataque_cuerpo_a_cuerpo, danio_fisico, es_humano, genero_masculino
    ])
]).

personaje(akali, lol, [
    nombre('Akali'),
    subtitulo('La Asesina Furtiva / Ionia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Akali_0.jpg'),
    rasgos([
        es_campeon_lol, es_asesino, carril_central_mid, carril_superior_top,
        de_ionia, usa_energia, ataque_cuerpo_a_cuerpo, danio_magico, es_humano,
        tiene_mascara_o_casco, genero_femenino
    ])
]).

personaje(viego, lol, [
    nombre('Viego'),
    subtitulo('El Rey Arruinado / Islas de la Sombra'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Viego_0.jpg'),
    rasgos([
        es_campeon_lol, es_asesino, es_luchador, jungla, de_islas_de_la_sombra,
        sin_recurso, ataque_cuerpo_a_cuerpo, danio_fisico, es_no_muerto,
        usa_espada, genero_masculino
    ])
]).

personaje(janna, lol, [
    nombre('Janna'),
    subtitulo('La Furia de la Tormenta / Zaun'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Janna_0.jpg'),
    rasgos([
        es_campeon_lol, es_soporte, es_mago, carril_inferior_soporte, de_zaun,
        usa_mana, ataque_a_distancia, danio_magico, vuela_o_flota, genero_femenino
    ])
]).

personaje(katarina, lol, [
    nombre('Katarina'),
    subtitulo('La Cuchilla Siniestra / Noxus'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Katarina_0.jpg'),
    rasgos([
        es_campeon_lol, es_asesino, carril_central_mid, de_noxus, sin_recurso,
        ataque_cuerpo_a_cuerpo, danio_magico, es_humano, genero_femenino
    ])
]).

personaje(ashe, lol, [
    nombre('Ashe'),
    subtitulo('La Arquera de Hielo / Freljord'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ashe_0.jpg'),
    rasgos([
        es_campeon_lol, es_tirador, carril_inferior_adc, de_freljord, usa_mana,
        ataque_a_distancia, danio_fisico, es_humano, genero_femenino
    ])
]).

personaje(caitlyn, lol, [
    nombre('Caitlyn'),
    subtitulo('La Sheriff de Piltóver'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Caitlyn_0.jpg'),
    rasgos([
        es_campeon_lol, es_tirador, carril_inferior_adc, de_piltover, usa_mana,
        ataque_a_distancia, danio_fisico, es_humano, usa_arma_de_fuego,
        genero_femenino
    ])
]).

personaje(miss_fortune, lol, [
    nombre('Miss Fortune'),
    subtitulo('La Cazarrecompensas / Aguasturbias'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/MissFortune_0.jpg'),
    rasgos([
        es_campeon_lol, es_tirador, carril_inferior_adc, de_aguasturbias, usa_mana,
        ataque_a_distancia, danio_fisico, es_humano, usa_arma_de_fuego,
        genero_femenino
    ])
]).

personaje(mordekaiser, lol, [
    nombre('Mordekaiser'),
    subtitulo('El Renacido de Hierro / Noxus'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Mordekaiser_0.jpg'),
    rasgos([
        es_campeon_lol, es_luchador, carril_superior_top, de_noxus, sin_recurso,
        ataque_cuerpo_a_cuerpo, danio_magico, es_no_muerto, tiene_mascara_o_casco,
        genero_masculino
    ])
]).

personaje(malphite, lol, [
    nombre('Malphite'),
    subtitulo('El Fragmento del Monolito / Shurima'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Malphite_0.jpg'),
    rasgos([
        es_campeon_lol, es_tanque, carril_superior_top, de_shurima, usa_mana,
        ataque_cuerpo_a_cuerpo, danio_magico, es_monstruo_o_criatura,
        sin_genero_o_monstruo
    ])
]).

personaje(blitzcrank, lol, [
    nombre('Blitzcrank'),
    subtitulo('El Gran Gólem de Vapor / Zaun'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Blitzcrank_0.jpg'),
    rasgos([
        es_campeon_lol, es_tanque, es_soporte, carril_inferior_soporte, de_zaun,
        usa_mana, ataque_cuerpo_a_cuerpo, danio_magico, es_monstruo_o_criatura,
        sin_genero_o_monstruo
    ])
]).

personaje(lucian, lol, [
    nombre('Lucian'),
    subtitulo('El Purificador / Demacia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Lucian_0.jpg'),
    rasgos([
        es_campeon_lol, es_tirador, carril_inferior_adc, de_demacia, usa_mana,
        ataque_a_distancia, danio_fisico, es_humano, usa_arma_de_fuego,
        genero_masculino
    ])
]).

personaje(sett, lol, [
    nombre('Sett'),
    subtitulo('El Jefe / Ionia'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Sett_0.jpg'),
    rasgos([
        es_campeon_lol, es_luchador, carril_superior_top, de_ionia, sin_recurso,
        ataque_cuerpo_a_cuerpo, danio_fisico, es_vastoia, genero_masculino
    ])
]).

personaje(braum, lol, [
    nombre('Braum'),
    subtitulo('El Corazón del Freljord'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Braum_0.jpg'),
    rasgos([
        es_campeon_lol, es_soporte, es_tanque, carril_inferior_soporte, de_freljord,
        usa_mana, ataque_cuerpo_a_cuerpo, danio_magico, es_humano,
        genero_masculino
    ])
]).

personaje(veigar, lol, [
    nombre('Veigar'),
    subtitulo('El Pequeño Maestro del Mal / Bandle'),
    imagen('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Veigar_0.jpg'),
    rasgos([
        es_campeon_lol, es_mago, carril_central_mid, de_bandle, usa_mana,
        ataque_a_distancia, danio_magico, es_yordle, tiene_mascara_o_casco,
        genero_masculino
    ])
]).

%% ====================================================================
%% METADATOS DE RASGOS, CATEGORIAS Y PREGUNTAS EN ESPAÑOL
%% ====================================================================

% rasgo_info(IdRasgo, CategoriaGeneral, PreguntaEspanol, EtiquetaCorta)
rasgo_info(es_futbolista, 'Mundo', '¿Es un jugador de fútbol profesional?', 'Futbolista').
rasgo_info(es_campeon_lol, 'Mundo', '¿Es un campeón de League of Legends?', 'Campeón de LoL').

% Futbol - Posiciones
rasgo_info(delantero, 'Posición Fútbol', '¿Juega de delantero?', 'Delantero').
rasgo_info(centrocampista, 'Posición Fútbol', '¿Juega en el mediocampo?', 'Centrocampista').
rasgo_info(defensa, 'Posición Fútbol', '¿Es defensa?', 'Defensa').
rasgo_info(portero, 'Posición Fútbol', '¿Es arquero / portero?', 'Portero').

% Futbol - Pie Hábil
rasgo_info(pie_zurdo, 'Pie Hábil', '¿Es zurdo (pie izquierdo)?', 'Zurdo').
rasgo_info(pie_diestro, 'Pie Hábil', '¿Es diestro (pie derecho)?', 'Diestro').

% Futbol - Origen / Continente
rasgo_info(origen_sudamerica, 'Continente Fútbol', '¿Es de origen sudamericano?', 'Sudamericano').
rasgo_info(origen_europa, 'Continente Fútbol', '¿Es de origen europeo?', 'Europeo').
rasgo_info(origen_africa, 'Continente Fútbol', '¿Es de origen africano?', 'Africano').

% Futbol - Países
rasgo_info(pais_argentina, 'País', '¿Es de nacionalidad argentina?', 'Argentina').
rasgo_info(pais_portugal, 'País', '¿Es de nacionalidad portuguesa?', 'Portugal').
rasgo_info(pais_francia, 'País', '¿Es de nacionalidad francesa?', 'Francia').
rasgo_info(pais_noruega, 'País', '¿Es de nacionalidad noruega?', 'Noruega').
rasgo_info(pais_brasil, 'País', '¿Es de nacionalidad brasileña?', 'Brasil').
rasgo_info(pais_espana, 'País', '¿Es de nacionalidad española?', 'España').
rasgo_info(pais_inglaterra, 'País', '¿Es de nacionalidad inglesa?', 'Inglaterra').
rasgo_info(pais_alemania, 'País', '¿Es de nacionalidad alemana?', 'Alemania').
rasgo_info(pais_belgica, 'País', '¿Es de nacionalidad belga?', 'Bélgica').
rasgo_info(pais_croacia, 'País', '¿Es de nacionalidad croata?', 'Croacia').
rasgo_info(pais_polonia, 'País', '¿Es de nacionalidad polaca?', 'Polonia').
rasgo_info(pais_egipto, 'País', '¿Es de nacionalidad egipcia?', 'Egipto').
rasgo_info(pais_holanda, 'País', '¿Es de nacionalidad neerlandesa?', 'Países Bajos').
rasgo_info(pais_uruguay, 'País', '¿Es de nacionalidad uruguaya?', 'Uruguay').
rasgo_info(pais_colombia, 'País', '¿Es de nacionalidad colombiana?', 'Colombia').

% Futbol - Equipos y Ligas
rasgo_info(juega_en_espana, 'Liga Fútbol', '¿Juega en la liga española (La Liga)?', 'Juega en España').
rasgo_info(juega_en_inglaterra, 'Liga Fútbol', '¿Juega en la Premier League inglesa?', 'Juega en Inglaterra').
rasgo_info(juega_en_alemania, 'Liga Fútbol', '¿Juega en la Bundesliga alemana?', 'Juega en Alemania').
rasgo_info(juega_en_arabia, 'Liga Fútbol', '¿Juega en la liga de Arabia Saudita?', 'Juega en Arabia').
rasgo_info(juega_en_usa, 'Liga Fútbol', '¿Juega en la MLS (Estados Unidos)?', 'Juega en USA').
rasgo_info(en_real_madrid, 'Club', '¿Juega o es leyenda del Real Madrid?', 'Real Madrid').
rasgo_info(en_barcelona, 'Club', '¿Juega o brilló en el FC Barcelona?', 'FC Barcelona').
rasgo_info(en_manchester_city, 'Club', '¿Juega en el Manchester City?', 'Manchester City').
rasgo_info(en_liverpool, 'Club', '¿Juega en el Liverpool FC?', 'Liverpool').
rasgo_info(en_bayern, 'Club', '¿Juega en el Bayern Múnich?', 'Bayern Múnich').
rasgo_info(en_al_nassr, 'Club', '¿Juega en el Al-Nassr?', 'Al-Nassr').
rasgo_info(en_inter_miami, 'Club', '¿Juega en el Inter Miami?', 'Inter Miami').
rasgo_info(en_atletico_madrid, 'Club', '¿Juega en el Atlético de Madrid?', 'Atlético Madrid').

% Futbol - Palmarés y Físico
rasgo_info(ha_ganado_balon_oro, 'Palmarés', '¿Ha ganado el Balón de Oro?', 'Balón de Oro').
rasgo_info(ha_ganado_mundial, 'Palmarés', '¿Ha sido campeón de la Copa del Mundo?', 'Campeón del Mundo').
rasgo_info(ha_ganado_champions, 'Palmarés', '¿Ha ganado la UEFA Champions League?', 'Campeón Champions').
rasgo_info(tiene_barba, 'Apariencia', '¿Tiene barba prominente?', 'Tiene barba').
rasgo_info(pelo_rubio, 'Apariencia', '¿Tiene el pelo rubio?', 'Pelo rubio').
rasgo_info(pelo_oscuro, 'Apariencia', '¿Tiene el pelo oscuro/castaño?', 'Pelo oscuro').
rasgo_info(estatura_muy_alta, 'Apariencia', '¿Es muy alto (más de 1.90m)?', 'Muy alto (>1.90m)').
rasgo_info(estatura_alta, 'Apariencia', '¿Es de estatura alta (1.85m - 1.90m)?', 'Estatura alta').
rasgo_info(usa_tatuajes, 'Apariencia', '¿Lleva tatuajes visibles?', 'Tatuajes visibles').

% LoL - Roles
rasgo_info(es_asesino, 'Rol LoL', '¿Tiene rol de Asesino?', 'Asesino').
rasgo_info(es_mago, 'Rol LoL', '¿Tiene rol de Mago?', 'Mago').
rasgo_info(es_tanque, 'Rol LoL', '¿Tiene rol de Tanque?', 'Tanque').
rasgo_info(es_tirador, 'Rol LoL', '¿Tiene rol de Tirador (ADC)?', 'Tirador').
rasgo_info(es_luchador, 'Rol LoL', '¿Tiene rol de Luchador?', 'Luchador').
rasgo_info(es_soporte, 'Rol LoL', '¿Tiene rol de Soporte?', 'Soporte').

% LoL - Carriles
rasgo_info(carril_superior_top, 'Carril LoL', '¿Se juega en el carril superior (Top)?', 'Top Lane').
rasgo_info(jungla, 'Carril LoL', '¿Se juega en la Jungla?', 'Jungla').
rasgo_info(carril_central_mid, 'Carril LoL', '¿Se juega en el carril central (Mid)?', 'Mid Lane').
rasgo_info(carril_inferior_adc, 'Carril LoL', '¿Se juega como tirador inferior (ADC)?', 'ADC Bot').
rasgo_info(carril_inferior_soporte, 'Carril LoL', '¿Se juega como soporte inferior?', 'Soporte Bot').

% LoL - Regiones
rasgo_info(de_ionia, 'Región LoL', '¿Pertenece o proviene de Ionia?', 'Ionia').
rasgo_info(de_demacia, 'Región LoL', '¿Pertenece a Demacia?', 'Demacia').
rasgo_info(de_noxus, 'Región LoL', '¿Pertenece al imperio de Noxus?', 'Noxus').
rasgo_info(de_freljord, 'Región LoL', '¿Proviene de las tierras gélidas del Freljord?', 'Freljord').
rasgo_info(de_zaun, 'Región LoL', '¿Es de la ciudad subterránea de Zaun?', 'Zaun').
rasgo_info(de_piltover, 'Región LoL', '¿Es de la ciudad del progreso Piltóver?', 'Piltóver').
rasgo_info(de_islas_de_la_sombra, 'Región LoL', '¿Es de las Islas de la Sombra?', 'Islas de la Sombra').
rasgo_info(de_shurima, 'Región LoL', '¿Proviene del desierto de Shurima?', 'Shurima').
rasgo_info(de_bandle, 'Región LoL', '¿Proviene de la Ciudad de Bandle?', 'Ciudad de Bandle').
rasgo_info(de_aguasturbias, 'Región LoL', '¿Es de las costas de Aguasturbias?', 'Aguasturbias').

% LoL - Recursos y Ataques
rasgo_info(usa_mana, 'Recurso LoL', '¿Utiliza maná como recurso?', 'Usa maná').
rasgo_info(usa_energia, 'Recurso LoL', '¿Utiliza energía ninja/marcial como recurso?', 'Usa energía').
rasgo_info(sin_recurso, 'Recurso LoL', '¿No gasta maná ni energía (sin coste/enfriamientos)?', 'Sin coste/Maná').
rasgo_info(ataque_cuerpo_a_cuerpo, 'Ataque LoL', '¿Su ataque básico es cuerpo a cuerpo?', 'Cuerpo a cuerpo').
rasgo_info(ataque_a_distancia, 'Ataque LoL', '¿Su ataque básico es a distancia?', 'A distancia').
rasgo_info(danio_fisico, 'Daño LoL', '¿Inflige principalmente daño físico (AD)?', 'Daño Físico').
rasgo_info(danio_magico, 'Daño LoL', '¿Inflige principalmente daño mágico (AP)?', 'Daño Mágico').

% LoL - Especie y Rasgos Visuales
rasgo_info(es_humano, 'Especie LoL', '¿Es de especie humana?', 'Humano').
rasgo_info(es_yordle, 'Especie LoL', '¿Es de raza Yordle?', 'Yordle').
rasgo_info(es_vastoia, 'Especie LoL', '¿Es de raza Vastoia (rasgos animales)?', 'Vastoia').
rasgo_info(es_no_muerto, 'Especie LoL', '¿Es un no-muerto o espectro?', 'No-muerto').
rasgo_info(es_monstruo_o_criatura, 'Especie LoL', '¿Es un monstruo, criatura o gólem?', 'Monstruo / Criatura').
rasgo_info(usa_espada, 'Armas LoL', '¿Empuña una espada o sable?', 'Usa espada').
rasgo_info(usa_arma_de_fuego, 'Armas LoL', '¿Usa pistolas, rifles o armas de fuego?', 'Arma de fuego').
rasgo_info(tiene_mascara_o_casco, 'Visual LoL', '¿Lleva máscara, casco o rostro cubierto?', 'Máscara o casco').
rasgo_info(vuela_o_flota, 'Visual LoL', '¿Vuela, levita o flota sin tocar el suelo?', 'Vuela o flota').
rasgo_info(genero_masculino, 'Género', '¿Es de género masculino?', 'Masculino').
rasgo_info(genero_femenino, 'Género', '¿Es de género femenino?', 'Femenino').
rasgo_info(sin_genero_o_monstruo, 'Género', '¿No tiene género humanoide definido (monstruo/gólem)?', 'Sin género').

%% ====================================================================
%% LOGICA DE LA PARTIDA & INFERENCIA
%% ====================================================================

%% Obtener lista de rasgos de un personaje
rasgos_de(IdPersonaje, ListaRasgos) :-
    personaje(IdPersonaje, _, Datos),
    member(rasgos(ListaRasgos), Datos).

%% Verificar si un personaje posee un rasgo
tiene_rasgo(IdPersonaje, Rasgo) :-
    rasgos_de(IdPersonaje, Lista),
    member(Rasgo, Lista).

%% Obtener información estructurada para el frontend
info_personaje(IdPersonaje, Dict) :-
    personaje(IdPersonaje, Cat, Datos),
    member(nombre(Nombre), Datos),
    member(subtitulo(Sub), Datos),
    member(imagen(Img), Datos),
    member(rasgos(Rasgos), Datos),
    Dict = json{
        id: IdPersonaje,
        categoria: Cat,
        nombre: Nombre,
        subtitulo: Sub,
        imagen: Img,
        rasgos: Rasgos
    }.

%% Filtrar personajes disponibles según modo
personajes_por_modo(futbol, Lista) :-
    findall(Id, personaje(Id, futbol, _), Lista).
personajes_por_modo(lol, Lista) :-
    findall(Id, personaje(Id, lol, _), Lista).
personajes_por_modo(mixto, Lista) :-
    findall(Id, personaje(Id, _, _), Lista).

%% Iniciar nueva partida
limpiar_partida :-
    retractall(partida_activa),
    retractall(modo_categoria(_)),
    retractall(dificultad_ia(_)),
    retractall(tablero_actual(_)),
    retractall(personaje_secreto_ia(_)),
    retractall(personaje_secreto_user(_)),
    retractall(turno_actual(_)),
    retractall(ganador_partida(_)),
    retractall(ia_hecho_si(_)),
    retractall(ia_hecho_no(_)),
    retractall(ia_candidatos(_)).

configurar_nueva_partida(Modo, Dificultad, NumCartas, InfoPartida) :-
    limpiar_partida,
    assert(partida_activa),
    assert(modo_categoria(Modo)),
    assert(dificultad_ia(Dificultad)),

    personajes_por_modo(Modo, Todos),
    random_permutation(Todos, Mezclados),
    (   Modo == mixto
    ->  % En modo mixto aseguramos representación equilibrada
        personajes_por_modo(futbol, FutbolAll),
        personajes_por_modo(lol, LolAll),
        random_permutation(FutbolAll, FutbolMezclados),
        random_permutation(LolAll, LolMezclados),
        Mitad is NumCartas // 2,
        Resto is NumCartas - Mitad,
        take(Mitad, FutbolMezclados, SubF),
        take(Resto, LolMezclados, SubL),
        append(SubF, SubL, Combinados),
        random_permutation(Combinados, Tablero)
    ;   take(NumCartas, Mezclados, Tablero)
    ),
    assert(tablero_actual(Tablero)),

    % La IA elige su personaje secreto del tablero
    random_member(SecretoIA, Tablero),
    assert(personaje_secreto_ia(SecretoIA)),

    % La IA arranca considerando a todos los personajes del tablero
    assert(ia_candidatos(Tablero)),

    % Moneda al aire para definir el primer turno
    random_member(PrimerTurno, [usuario, ia]),
    assert(turno_actual(PrimerTurno)),

    % Formatear datos del tablero para el frontend
    maplist(info_personaje, Tablero, TableroInfo),

    % Lista de preguntas/rasgos presentes en el tablero para seleccionar
    obtener_preguntas_tablero(Tablero, PreguntasDisponibles),

    InfoPartida = json{
        ok: true,
        tablero: TableroInfo,
        primer_turno: PrimerTurno,
        preguntas_disponibles: PreguntasDisponibles,
        total_personajes: NumCartas,
        modo: Modo,
        dificultad: Dificultad
    }.

%% Tomar N elementos de una lista
take(0, _, []) :- !.
take(_, [], []) :- !.
take(N, [H|T], [H|R]) :-
    N > 0,
    N1 is N - 1,
    take(N1, T, R).

%% Obtener las preguntas relevantes que aparecen en los personajes del tablero
obtener_preguntas_tablero(Tablero, ListaPreguntas) :-
    findall(Rasgo, (
        member(P, Tablero),
        tiene_rasgo(P, Rasgo)
    ), TodosRasgos),
    sort(TodosRasgos, RasgosUnicos),
    findall(json{ id: RasgoId, categoria: Cat, pregunta: Preg, etiqueta: Etq }, (
        member(RasgoId, RasgosUnicos),
        rasgo_info(RasgoId, Cat, Preg, Etq)
    ), ListaPreguntas).

%% ====================================================================
%% TURNO DEL USUARIO
%% ====================================================================

%% Usuario pregunta sobre un rasgo
procesar_pregunta_usuario(RasgoAtom, Resultado) :-
    personaje_secreto_ia(SecretoIA),
    tablero_actual(Tablero),
    (   tiene_rasgo(SecretoIA, RasgoAtom)
    ->  Respuesta = 'si',
        % Quienes NO tienen el rasgo quedan descartados para el usuario
        findall(P, (member(P, Tablero), \+ tiene_rasgo(P, RasgoAtom)), Descartados)
    ;   Respuesta = 'no',
        % Quienes SI tienen el rasgo quedan descartados para el usuario
        findall(P, (member(P, Tablero), tiene_rasgo(P, RasgoAtom)), Descartados)
    ),
    rasgo_info(RasgoAtom, _, PreguntaTexto, _),
    % Pasa el turno a la IA
    retractall(turno_actual(_)),
    assert(turno_actual(ia)),
    Resultado = json{
        ok: true,
        respuesta: Respuesta,
        rasgo: RasgoAtom,
        pregunta_texto: PreguntaTexto,
        descartar_personajes: Descartados,
        siguiente_turno: ia
    }.

%% Usuario intenta adivinar el personaje secreto de la IA
procesar_adivinanza_usuario(PersonajeSugerido, Resultado) :-
    personaje_secreto_ia(SecretoIA),
    (   PersonajeSugerido == SecretoIA
    ->  retractall(turno_actual(_)),
        assert(turno_actual(fin)),
        retractall(ganador_partida(_)),
        assert(ganador_partida(usuario)),
        info_personaje(SecretoIA, InfoSecreto),
        Resultado = json{
            ok: true,
            acierto: true,
            ganador: usuario,
            personaje_ia: InfoSecreto,
            mensaje: '¡Correcto! Has adivinado el personaje secreto de la IA. ¡Has ganado!'
        }
    ;   % Falló: pierde el turno y le toca a la IA
        retractall(turno_actual(_)),
        assert(turno_actual(ia)),
        Resultado = json{
            ok: true,
            acierto: false,
            ganador: ninguno,
            siguiente_turno: ia,
            mensaje: 'Ese no es el personaje secreto de la IA. Pierdes tu turno.'
        }
    ).

%% ====================================================================
%% MOTOR HEURISTICO Y TURNO DE LA IA
%% ====================================================================

%% La IA evalúa y ejecuta su turno
procesar_turno_ia(Resultado) :-
    ia_candidatos(Candidatos),
    personaje_secreto_user(SecretoUser),
    dificultad_ia(Dificultad),
    length(Candidatos, NumCandidatos),
    (   NumCandidatos =< 1
    ->  % Caso 1: La IA tiene 1 o menos candidatos -> Adivina inmediatamente
        (   Candidatos = [CandidatoUnico]
        ->  PersonajeAdivinar = CandidatoUnico
        ;   tablero_actual(Tablero), random_member(PersonajeAdivinar, Tablero)
        ),
        ejecutar_adivinanza_ia(PersonajeAdivinar, SecretoUser, Resultado)
    ;   % Caso 2: Pregunta un rasgo para recortar candidatos
        seleccionar_mejor_pregunta_ia(Dificultad, Candidatos, MejorRasgo),
        ejecutar_pregunta_ia(MejorRasgo, SecretoUser, Candidatos, Resultado)
    ).

%% La IA adivina el personaje del usuario
ejecutar_adivinanza_ia(PersonajeAdivinar, SecretoUser, Resultado) :-
    info_personaje(PersonajeAdivinar, InfoAdivinado),
    (   PersonajeAdivinar == SecretoUser
    ->  retractall(turno_actual(_)),
        assert(turno_actual(fin)),
        retractall(ganador_partida(_)),
        assert(ganador_partida(ia)),
        Resultado = json{
            ok: true,
            tipo_accion: adivinanza,
            acierto: true,
            personaje_adivinado: InfoAdivinado,
            ganador: ia,
            mensaje: 'La IA ha adivinado tu personaje secreto correctamente. ¡La IA gana!'
        }
    ;   % La IA falló su tiro
        retractall(turno_actual(_)),
        assert(turno_actual(usuario)),
        % Descarta ese personaje de sus candidatos
        ia_candidatos(CandActuales),
        delete(CandActuales, PersonajeAdivinar, NuevosCand),
        retractall(ia_candidatos(_)),
        assert(ia_candidatos(NuevosCand)),
        Resultado = json{
            ok: true,
            tipo_accion: adivinanza,
            acierto: false,
            personaje_adivinado: InfoAdivinado,
            ganador: ninguno,
            siguiente_turno: usuario,
            ia_candidatos_restantes: NuevosCand,
            mensaje: 'La IA intentó adivinar tu personaje pero falló. Tu turno.'
        }
    ).

%% La IA formula una pregunta
ejecutar_pregunta_ia(Rasgo, SecretoUser, Candidatos, Resultado) :-
    rasgo_info(Rasgo, _, PreguntaTexto, _),
    (   tiene_rasgo(SecretoUser, Rasgo)
    ->  RespuestaUsuario = 'si',
        assert(ia_hecho_si(Rasgo)),
        % Conserva solo los que SI tienen el rasgo
        include(tiene_rasgo_aux(Rasgo), Candidatos, NuevosCandidatos)
    ;   RespuestaUsuario = 'no',
        assert(ia_hecho_no(Rasgo)),
        % Conserva solo los que NO tienen el rasgo
        exclude(tiene_rasgo_aux(Rasgo), Candidatos, NuevosCandidatos)
    ),
    retractall(ia_candidatos(_)),
    assert(ia_candidatos(NuevosCandidatos)),
    retractall(turno_actual(_)),
    assert(turno_actual(usuario)),
    length(NuevosCandidatos, RestantesNum),
    Resultado = json{
        ok: true,
        tipo_accion: pregunta,
        rasgo: Rasgo,
        pregunta_texto: PreguntaTexto,
        respuesta_usuario: RespuestaUsuario,
        ia_candidatos_restantes_count: RestantesNum,
        siguiente_turno: usuario,
        mensaje: 'La IA ha formulado su pregunta y se ha resuelto.'
    }.

tiene_rasgo_aux(Rasgo, P) :- tiene_rasgo(P, Rasgo).

%% Selección de la mejor pregunta
seleccionar_mejor_pregunta_ia(facil, Candidatos, RasgoElegido) :-
    rasgos_disponibles_no_preguntados(Candidatos, RasgosCandidatos),
    (   RasgosCandidatos \= []
    ->  random_member(RasgoElegido, RasgosCandidatos)
    ;   % Fallback
        random_member(P, Candidatos),
        rasgos_de(P, [RasgoElegido|_])
    ).

seleccionar_mejor_pregunta_ia(dificil, Candidatos, RasgoElegido) :-
    rasgos_disponibles_no_preguntados(Candidatos, RasgosCandidatos),
    length(Candidatos, Total),
    ObjetivoMitad is Total / 2.0,
    (   RasgosCandidatos \= []
    ->  maplist(puntuar_rasgo_50_50(Candidatos, ObjetivoMitad), RasgosCandidatos, Puntuados),
        sort(Puntuados, [ _-RasgoElegido | _ ])
    ;   random_member(P, Candidatos),
        rasgos_de(P, [RasgoElegido|_])
    ).

%% Rasgos que tienen los candidatos actuales y que la IA aún no ha preguntado
rasgos_disponibles_no_preguntados(Candidatos, RasgosValidos) :-
    findall(R, (
        member(P, Candidatos),
        tiene_rasgo(P, R),
        \+ ia_hecho_si(R),
        \+ ia_hecho_no(R)
    ), Todos),
    sort(Todos, RasgosValidos).

%% Calcula qué tan cerca está de dividir a los candidatos en 50/50
puntuar_rasgo_50_50(Candidatos, ObjetivoMitad, Rasgo, Diferencia-Rasgo) :-
    include(tiene_rasgo_aux(Rasgo), Candidatos, QuienesLoTienen),
    length(QuienesLoTienen, Cuantos),
    Diferencia is abs(Cuantos - ObjetivoMitad).

%% ====================================================================
%% ENDPOINTS HTTP Y SERVIDOR WEB (SWI-PROLOG)
%% ====================================================================

server(Port) :-
    http_server(http_dispatch, [port(Port)]).

%% RUTA: Healthcheck / Saludo
:- http_handler(root(.), say_hi, []).
say_hi(_Request) :-
    cors_enable,
    format('Content-type: application/json; charset=UTF-8~n~n'),
    reply_json_dict(json{
        app: "Quien es Quien: Futbol y League of Legends",
        estado: "activo",
        version: "2.0"
    }).

%% RUTA: Iniciar Partida
:- http_handler(root('api/iniciar'), handle_iniciar, [methods([post, options])]).
handle_iniciar(Request) :-
    member(method(options), Request), !,
    cors_enable([methods([post, options])]),
    format('Content-type: text/plain~n~n').

handle_iniciar(Request) :-
    cors_enable,
    http_read_json_dict(Request, DictIn),
    ModoAtom = DictIn.get(modo, futbol),
    DificultadAtom = DictIn.get(dificultad, dificil),
    NumCartas = DictIn.get(num_cartas, 20),
    configurar_nueva_partida(ModoAtom, DificultadAtom, NumCartas, InfoPartida),
    reply_json_dict(InfoPartida).

%% RUTA: Fijar Personaje Secreto del Usuario
:- http_handler(root('api/fijar_personaje_usuario'), handle_fijar_usuario, [methods([post, options])]).
handle_fijar_usuario(Request) :-
    member(method(options), Request), !,
    cors_enable([methods([post, options])]),
    format('Content-type: text/plain~n~n').

handle_fijar_usuario(Request) :-
    cors_enable,
    http_read_json_dict(Request, DictIn),
    PersonajeId = DictIn.get(personaje_id),
    retractall(personaje_secreto_user(_)),
    assert(personaje_secreto_user(PersonajeId)),
    turno_actual(Turno),
    reply_json_dict(json{
        ok: true,
        personaje_usuario: PersonajeId,
        turno_actual: Turno
    }).

%% RUTA: Usuario Pregunta un Rasgo
:- http_handler(root('api/usuario_preguntar'), handle_usuario_preguntar, [methods([post, options])]).
handle_usuario_preguntar(Request) :-
    member(method(options), Request), !,
    cors_enable([methods([post, options])]),
    format('Content-type: text/plain~n~n').

handle_usuario_preguntar(Request) :-
    cors_enable,
    http_read_json_dict(Request, DictIn),
    Rasgo = DictIn.get(rasgo),
    atom_string(RasgoAtom, Rasgo),
    procesar_pregunta_usuario(RasgoAtom, Resultado),
    reply_json_dict(Resultado).

%% RUTA: Usuario Intenta Adivinar
:- http_handler(root('api/usuario_adivinar'), handle_usuario_adivinar, [methods([post, options])]).
handle_usuario_adivinar(Request) :-
    member(method(options), Request), !,
    cors_enable([methods([post, options])]),
    format('Content-type: text/plain~n~n').

handle_usuario_adivinar(Request) :-
    cors_enable,
    http_read_json_dict(Request, DictIn),
    Personaje = DictIn.get(personaje_id),
    atom_string(PersonajeAtom, Personaje),
    procesar_adivinanza_usuario(PersonajeAtom, Resultado),
    reply_json_dict(Resultado).

%% RUTA: Turno de la IA
:- http_handler(root('api/turno_ia'), handle_turno_ia, [methods([post, options])]).
handle_turno_ia(Request) :-
    member(method(options), Request), !,
    cors_enable([methods([post, options])]),
    format('Content-type: text/plain~n~n').

handle_turno_ia(_Request) :-
    cors_enable,
    procesar_turno_ia(Resultado),
    reply_json_dict(Resultado).

%% RUTA: Resetear Todo
:- http_handler(root('api/resetear'), handle_resetear, [methods([post, options])]).
handle_resetear(Request) :-
    member(method(options), Request), !,
    cors_enable([methods([post, options])]),
    format('Content-type: text/plain~n~n').

handle_resetear(_Request) :-
    cors_enable,
    limpiar_partida,
    reply_json_dict(json{ ok: true, mensaje: "Partida reseteada" }).

%% INICIALIZACION AUTOMATICA DEL SERVIDOR EN PUERTO 8002 AL CARGAR
:- initialization(server(8002)).