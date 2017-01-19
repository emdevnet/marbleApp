'use strict';

document.addEventListener('DOMContentLoaded', function() {

    var AUDIO_PATH;

    var canvas;
    var context;
    var watchId;
    var sounds;
    var menu;
    var button_start;

    var app = {

        // Application Constructor
        initialize: function initializeApp() {
            document.addEventListener('deviceready', app.menu);
        },

        // Initialise l'évènement du menu
        menu: function() {
            menu         = document.getElementById('menu');
            button_start = document.getElementById('button_start');

            button_start.addEventListener('click', function() {
                menu.style.display = 'none';
                app.start();
            }, false);
        },

        // Démarrage du jeu
        start: function startGame() {

            // Vérifie si on est dans l'environnement d'émulation Ripple
            app.isRipple = window.parent && window.parent.ripple;

            AUDIO_PATH = location.origin + '/' + (device.platform.toLowerCase()) + '/www/audio/';
            if (app.isRipple) {
                AUDIO_PATH = 'audio/';
            }
            
            // Récupération de l'élément canvas
            canvas = document.getElementById('gamezone');
            context = canvas.getContext('2d'); // Récupération du "contexte de dessin" de ce canvas : c'est grâce à ce contexte que l'on pourra dessiner sur le canvas
            canvas.style.display = 'block';
            canvas.classList.add('show');
            canvas.classList.remove('hide');

            // Par défaut un canvas fait 300x150 pixels : On va modifier ces dimensions pour l'adapter à la taille de l'écran
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;

            // Création d'un objet "bille" qui comprend l'élément HTML à dessiner sur le canvas (<img>), et des coordonnées x et y
            app.bille = {
                el: document.getElementById('bille'),
                x: 100,
                y: 100,
                scale: 1,
                isFalling: false
            };

            // Création d'un objet "hole" qui comprend l'élément HTML à dessiner sur le canvas (<img>), et des coordonnées x et y
            app.hole = {
                el : document.getElementById('hole'),
                x  : 30,
                y  : 30
            };

            // Création d'un objet joueur, pour y stocker son score et son timer
            app.player = {
                score : 0,
                timer : 30 // temps en secondes
            };

            // Création d'un objet x et y de valeur qui proviendront de l'accéléromètre de l'appareil
            app.accValues = {
                x : 0,
                y : 0
            };

            // Arrête le timer qui tournait toutes les secondes (dans le cas où on avait recommencé une partie)
            window.clearInterval(app.timer);

            // Démarrage du timer
            app.timer = window.setInterval(function() {
                app.player.timer--;

                // Game over
                if (app.player.timer < 0) {
                    // Masquer le canvas de jeu
                    canvas.classList.remove('show');
                    // Affichage du menu "gameover"
                    var gameover = document.querySelector('#gameover');
                    var score = document.querySelector('#score');
                    var button_restart = document.querySelector('#button_restart');

                    score.textContent = app.player.score;
                    gameover.style.display = 'block';
                    button_restart.addEventListener('click', function() {
                        app.start();
                    }, false);

                    // Arrête la boucle qui tournait à 60 fps (dans le cas où on avait recommencé une partie)
                    cancelAnimationFrame(app.frame);
                    // Et arrêt également de l'écoute de l'accelerometre
                    navigator.accelerometer.clearWatch(watchId);
                }
            }, 1000);

            // Gestion des sons
            sounds = {};

            if (Media) {
                sounds.rebond = new Media(AUDIO_PATH + 'rebound.mp3', function(succ) {
                    for(var e in succ) { alert(succ[e])} }, function(err) { for(var e in err) { alert(err[e])} }, null);
            }

            // Vérrouillage de l'orientation au format 'portrait' grâce au plugin
            window.screen.lockOrientation('portrait');

            // On écoute de l'acceleromètre via le plugin Cordova "device-motion" qui étend l'objet `navigator`
            watchId = navigator.accelerometer.watchAcceleration(app.updateAcc, null, {frequency:10});

            // Premier appel à la fonction d'animation (qui par la suite se rappellera elle-même automatiquement environ 60 fois par secondes via requestAnimationFrame)
            app.animate();

        },

        updateAcc : function updateAcceleration(accelerometer) {

            var x = accelerometer.x * -1;
            var y = accelerometer.y;

            // Ripple n'est pas standard sur les valeurs renvoyées de l'acceleromètre.
            // Il inverse carrément x et y ... du coup, on multiplie par -1 pour ré-avoir qqch de cohérent
            if (app.isRipple) {
                x *= -1;
                y *= -1;
            }

            // Plugin Cordova
            app.accValues.x += x;
            app.accValues.y += y;

        },

        animate: function animateCanvas() {

            // Mise à jour des coordonnées de la bille
            app.bille.x += (app.accValues.x * 0.5);
            app.bille.y += (app.accValues.y * 0.5);

            // Vérification si la bille sort des limites en X
            if (app.bille.x - app.bille.el.width/2 < 0) { // Dépassement vers la gauche ?
                app.bille.x = app.bille.el.width/2;
                app.accValues.x *= -0.6; // Effet de rebondissement en X
            }
            else if (app.bille.x + app.bille.el.width/2 > canvas.width) { // Dépassement vers la droite ?
                app.bille.x = canvas.width - app.bille.el.width/2;
                app.accValues.x *= -0.6; // Effet de rebondissement en X
            }
            // Vérification si la bille sort des limites en Y
            if (app.bille.y - app.bille.el.height/2 < 0) { // Dépassement vers le haut ?
                app.bille.y = app.bille.el.height/2;
                app.accValues.y *= -0.6; // Effet de rebondissement en Y
            }
            else if (app.bille.y + app.bille.el.height/2 > canvas.height) { // Dépassement vers le bas ?
                app.bille.y = canvas.height - app.bille.el.height/2;
                app.accValues.y *= -0.6; // Effet de rebondissement en Y
            }

            // Vérification si la bille entre dans le trou
            var distance = getDistance(
                app.bille.x,
                app.bille.y,
                app.hole.x + 83 + app.bille.el.width/2,
                app.hole.y + 59 + app.bille.el.height/2
            );
            if (distance <= 15 && !app.bille.isFalling) {
                app.bille.isFalling = true;
                app.player.score++;
            }

            // Vérification si la bille est en train de tomber
            if (app.bille.isFalling) {
                app.bille.scale -= 0.01;

                app.bille.x = app.hole.x + 83 + app.bille.el.width/2;
                app.bille.y = app.hole.y + 59 + app.bille.el.height/2;

                if (app.bille.scale <= 0) {
                    sounds.rebond.play();

                    app.hole.x = rand(0 - 83, canvas.width - app.hole.el.width + 54);
                    app.hole.y = rand(0 - 59 + 32, canvas.height - app.hole.el.height + 69);

                    app.bille.isFalling = false;
                    app.bille.scale = 1;
                }
            }

            // Effacement du canvas à chaque frame d'animation
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Dessin du trou à ses propres coordonnées
            context.drawImage(app.hole.el, app.hole.x, app.hole.y);
            // DEBUG : Dessin des contours du trou
            // context.strokeStyle = "#000";
            // context.strokeRect(app.hole.x, app.hole.y, app.hole.el.width, app.hole.el.height);

            // Dessin de la bille à ses propres coordonnées
            context.save();
            context.translate(app.bille.x, app.bille.y);
            context.scale(app.bille.scale, app.bille.scale);
            context.drawImage(app.bille.el, -app.bille.el.width * 0.5, -app.bille.el.height * 0.5);
            context.restore();

            // Dessin du scoring et du timer
            var minutes = Math.floor(app.player.timer / 60);
            var secondes = app.player.timer % 60;
            context.font         = '28px "Open Sans", sans-serif';
            context.textAlign    = 'left';
            context.textBaseline = 'top';
            context.fillText(leftPad(minutes, 2, 0) + ':' + leftPad(secondes, 2, 0), 5, 0);
            context.textAlign    = 'right';
            context.textBaseline = 'top';
            context.fillText('Score: ' + app.player.score, canvas.width - 5, 0);

            app.frame = requestAnimationFrame(app.animate);
        }
        
    };

    // ============================
    // === FONCTIONS UTILITAIRE ===
    // ============================

    function getDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x1-x2,2) + Math.pow(y1-y2,2));
    }

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function leftPad (str, len, ch) {
        var cache = [
          '',
          ' ',
          '  ',
          '   ',
          '    ',
          '     ',
          '      ',
          '       ',
          '        ',
          '         '
        ];
      // convert `str` to `string`
      str = str + '';
      // `len` is the `pad`'s length now
      len = len - str.length;
      // doesn't need to pad
      if (len <= 0) return str;
      // `ch` defaults to `' '`
      if (!ch && ch !== 0) ch = ' ';
      // convert `ch` to `string`
      ch = ch + '';
      // cache common use cases
      if (ch === ' ' && len < 10) return cache[len] + str;
      // `pad` starts with an empty string
      var pad = '';
      // loop
      while (true) {
        // add `ch` to `pad` if `len` is odd
        if (len & 1) pad += ch;
        // divide `len` by 2, ditch the remainder
        len >>= 1;
        // "double" the `ch` so this operation count grows logarithmically on `len`
        // each time `ch` is "doubled", the `len` would need to be "doubled" too
        // similar to finding a value in binary search tree, hence O(log(n))
        if (len) ch += ch;
        // `len` is 0, exit the loop
        else break;
      }
      // pad `str`!
      return pad + str;
    }

    // ==================================
    // === DÉMARRAGE DE L'APPLICATION ===
    // ==================================

    app.initialize();

}); // Fin du 'DOMContentLoaded'