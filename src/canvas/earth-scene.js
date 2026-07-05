'use strict';

/** @typedef {{ spots?: unknown[], friends?: unknown[], styles?: Record<string, unknown> }} EarthConfig */

/** @type {EarthConfig} */
let earthConfig = { spots: [], friends: [], styles: {} };

/** @param {EarthConfig} config */
export function setEarthConfig(config) {
    earthConfig = config || { spots: [], friends: [], styles: {} };
}

    var SPOT_PALETTES = {
        star: { ring: '120, 210, 255', glow: '160, 230, 255', core: '#ffffff' },
        amber: { ring: '255, 180, 90', glow: '255, 200, 120', core: '#fff6e8' },
        violet: { ring: '180, 120, 255', glow: '200, 160, 255', core: '#f3ebff' },
        rose: { ring: '255, 130, 190', glow: '255, 170, 210', core: '#fff0f7' },
        mint: { ring: '100, 230, 190', glow: '130, 255, 210', core: '#ecfff8' },
        ember: { ring: '255, 130, 60', glow: '255, 160, 80', core: '#fff1e6' },
        friend: { ring: '255, 175, 110', glow: '255, 210, 150', core: '#fff9f2' }
    };

    var avatarCache = {
        images: {},
        load: function (url, callback) {
            if (!url) {
                callback(null);
                return;
            }
            var cached = this.images[url];
            if (cached === 'error') {
                callback(null);
                return;
            }
            if (cached && cached.complete && cached.naturalWidth > 0) {
                callback(cached);
                return;
            }
            if (!cached) {
                cached = new Image();
                cached.crossOrigin = 'anonymous';
                cached.onload = function () {
                    callback(cached);
                };
                cached.onerror = function () {
                    avatarCache.images[url] = 'error';
                    callback(null);
                };
                cached.src = url;
                this.images[url] = cached;
            } else {
                cached.onload = function () {
                    callback(cached);
                };
            }
        }
    };

    function normalizeSpotStyle(style) {
        var key = String(style || 'star').toLowerCase();
        return SPOT_PALETTES[key] ? key : 'star';
    }

    function getSpotPalette(style) {
        return SPOT_PALETTES[normalizeSpotStyle(style)] || SPOT_PALETTES.star;
    }

    var settings = {
        ROTATION: 0.005,
        FOV: 420,
        GLOBE_R: 136,
        SAT_ORBIT_BASE: 46,
        SAT_ORBIT_STEP: 14,
        MAX_SPEED: 0.012,
        DESIRED_SEPARATION: 0.8,
        SEPARATION_WEIGHT: 2.5
    };

    var landColors = ['#2d8a52', '#3da864', '#4cb978', '#6a9a4a', '#8b7355'];
    var oceanColors = ['#0e3d6b', '#145a8a', '#1a6fa3', '#0b3058'];
    var cloudColor = 'rgba(235, 245, 255, 0.55)';

    var LAND_SHAPES = [
        { lon: -98, lat: 58, w: 62, h: 16 },
        { lon: -98, lat: 42, w: 48, h: 22 },
        { lon: -78, lat: 28, w: 22, h: 14 },
        { lon: -62, lat: -14, w: 26, h: 40 },
        { lon: -18, lat: 54, w: 36, h: 16 },
        { lon: 8, lat: 48, w: 24, h: 14 },
        { lon: -8, lat: 8, w: 34, h: 44 },
        { lon: 38, lat: 30, w: 28, h: 22 },
        { lon: 78, lat: 22, w: 38, h: 28 },
        { lon: 105, lat: 35, w: 42, h: 26 },
        { lon: 138, lat: -28, w: 30, h: 18 },
        { lon: 172, lat: -44, w: 18, h: 24 },
        { lon: -52, lat: 70, w: 36, h: 12 },
        { lon: 38, lat: -75, w: 28, h: 10 }
    ];

    function Vector(x, y, z) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
    }

    Vector.prototype.copy = function () {
        return new Vector(this.x, this.y, this.z);
    };
    Vector.prototype.magnitude = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    };
    Vector.prototype.normalize = function () {
        var m = this.magnitude();
        if (m > 0) {
            this.divide(m);
        }
        return this;
    };
    Vector.prototype.limit = function (max) {
        if (this.magnitude() > max) {
            this.normalize().multiply(max);
        }
        return this;
    };
    Vector.prototype.subtract = function (o) {
        this.x -= o.x;
        this.y -= o.y;
        this.z -= o.z;
        return this;
    };
    Vector.prototype.add = function (o) {
        this.x += o.x;
        this.y += o.y;
        this.z += o.z;
        return this;
    };
    Vector.prototype.divide = function (n) {
        this.x /= n;
        this.y /= n;
        this.z /= n;
        return this;
    };
    Vector.prototype.multiply = function (n) {
        this.x *= n;
        this.y *= n;
        this.z *= n;
        return this;
    };
    Vector.prototype.distance = function (o) {
        var dx = this.x - o.x;
        var dy = this.y - o.y;
        var dz = this.z - o.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    Vector.subtract = function (a, b) {
        return a.copy().subtract(b);
    };

    function normalizeLon(lon) {
        var v = lon % 360;
        if (v > 180) {
            v -= 360;
        }
        if (v < -180) {
            v += 360;
        }
        return v;
    }

    function isLandAt(lon, lat) {
        lon = normalizeLon(lon);
        var i;
        for (i = 0; i < LAND_SHAPES.length; i++) {
            var s = LAND_SHAPES[i];
            var dx = (lon - s.lon) / (s.w * 0.5);
            var dy = (lat - s.lat) / (s.h * 0.5);
            if (dx * dx + dy * dy <= 1) {
                return true;
            }
        }
        return false;
    }

    function latLngToVector(lat, lng, radius) {
        var phi = (90 - lat) * Math.PI / 180;
        var theta = (lng + 180) * Math.PI / 180;
        return new Vector(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
    }

    function vectorToLatLng(vec) {
        var r = vec.magnitude() || 1;
        var phi = Math.acos(Math.max(-1, Math.min(1, vec.z / r)));
        var lat = 90 - phi * 180 / Math.PI;
        var theta = Math.atan2(vec.y, vec.x);
        var lng = theta * 180 / Math.PI - 180;
        return { lat: lat, lng: normalizeLon(lng) };
    }

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function Point(location, velocity, ctx) {
        this.pos = location.copy();
        this.vel = velocity.copy();
        this.ctx = ctx;
        this.history = [];
        this.type = 'ocean';
        this.color = pick(oceanColors);
        this.size = 1;
    }

    Point.prototype.rotateY = function (angle) {
        var x = this.pos.x;
        var z = this.pos.z;
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        this.pos.x = x * cos + z * sin;
        this.pos.z = x * -sin + z * cos;
    };

    Point.prototype.rotateX = function (angle) {
        var y = this.pos.y;
        var z = this.pos.z;
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        this.pos.y = y * cos + z * sin;
        this.pos.z = y * -sin + z * cos;
    };

    Point.prototype.separate = function (neighbors) {
        var mean = new Vector();
        var count = 0;
        var i;
        for (i = 0; i < neighbors.length; i++) {
            var d = this.pos.distance(neighbors[i].pos);
            if (d > 0 && d < settings.DESIRED_SEPARATION && Math.abs(this.pos.z - neighbors[i].pos.z) < 20) {
                mean.add(Vector.subtract(this.pos, neighbors[i].pos).normalize().divide(d));
                count++;
            }
        }
        if (count > 0) {
            mean.divide(count);
        }
        return mean;
    };

    Point.prototype.flock = function (neighbors) {
        return this.separate(neighbors).multiply(settings.SEPARATION_WEIGHT);
    };

    Point.prototype.step = function (neighbors) {
        if (this.type === 'cloud') {
            var z = this.pos.z;
            var acc = this.flock(neighbors);
            acc.x += (Math.random() - 0.5) * 0.0004;
            acc.y += (Math.random() - 0.5) * 0.0004;
            this.vel.add(acc).limit(settings.MAX_SPEED).multiply(0.98);
            this.pos.add(this.vel);
            this.pos.z = z;
            this.rotateX(this.vel.x);
            this.rotateY(this.vel.y);
            this.rotateY(settings.ROTATION * 0.5);
        } else {
            this.rotateY(settings.ROTATION);
        }
    };

    Point.prototype.project = function (cx, cy) {
        if (this.pos.z > 20) {
            return null;
        }
        var scale = settings.FOV / (settings.FOV + this.pos.z);
        return {
            x: this.pos.x * scale + cx,
            y: this.pos.y * scale + cy,
            scale: scale,
            z: this.pos.z
        };
    };

    Point.prototype.draw = function (cx, cy) {
        var p = this.project(cx, cy);
        if (!p) {
            return;
        }

        var radius = Math.max(0.35, p.scale * this.size);
        var ctx = this.ctx;

        if (this.type === 'cloud' && this.history.length) {
            var h;
            for (h = 0; h < this.history.length; h++) {
                var hp = this.history[h];
                var hs = settings.FOV / (settings.FOV + hp.z);
                ctx.globalAlpha = 0.08 * (h / this.history.length);
                ctx.fillStyle = cloudColor;
                ctx.beginPath();
                ctx.arc(hp.x * hs + cx, hp.y * hs + cy, Math.abs(hs * 4.5), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
    };

    function EarthSpot(data) {
        this.lat = data.lat;
        this.lng = data.lng;
        this.title = data.title || '';
        this.text = data.text || '';
        this.style = normalizeSpotStyle(data.style);
        this.url = data.url || '';
        this.linkLabel = data.linkLabel || data.link_label || '';
        this.index = typeof data.index === 'number' ? data.index : -1;
        this.kind = 'spot';
        this.pos = latLngToVector(this.lat, this.lng, settings.GLOBE_R + 2);
        this.screen = null;
        this.hover = false;
        this.active = false;
        this.pulse = Math.random() * Math.PI * 2;
        this.palette = getSpotPalette(this.style);
    }

    EarthSpot.prototype.rotateY = function (angle) {
        var x = this.pos.x;
        var z = this.pos.z;
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        this.pos.x = x * cos + z * sin;
        this.pos.z = x * -sin + z * cos;
    };

    EarthSpot.prototype.step = function () {
        this.rotateY(settings.ROTATION);
        this.pulse += 0.045;
    };

    EarthSpot.prototype.project = function (cx, cy) {
        if (this.pos.z > 10) {
            this.screen = null;
            return null;
        }
        var scale = settings.FOV / (settings.FOV + this.pos.z);
        this.screen = {
            x: this.pos.x * scale + cx,
            y: this.pos.y * scale + cy,
            scale: scale,
            z: this.pos.z
        };
        return this.screen;
    };

    EarthSpot.prototype.draw = function (ctx, cx, cy) {
        var p = this.project(cx, cy);
        if (!p) {
            return;
        }

        var base = 5 + p.scale * 3;
        var pulse = 0.55 + Math.sin(this.pulse) * 0.25;
        var alpha = this.active ? 1 : (this.hover ? 0.95 : 0.78);
        var palette = this.palette || SPOT_PALETTES.star;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(' + palette.ring + ', ' + (0.18 + pulse * 0.22) + ')';
        ctx.lineWidth = 1.2;
        ctx.arc(p.x, p.y, base + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + palette.glow + ', ' + (alpha * 0.35) + ')';
        ctx.arc(p.x, p.y, base + 2 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = palette.core;
        ctx.globalAlpha = alpha;
        ctx.arc(p.x, p.y, base * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.restore();
    };

    EarthSpot.prototype.hitRadius = function () {
        if (!this.screen) {
            return 0;
        }
        return 16 + this.screen.scale * 4;
    };

    function EarthSatellite(data, index, total) {
        this.title = data.title || '';
        this.text = data.text || '';
        this.url = data.url || '';
        this.avatar = data.avatar || '';
        this.linkLabel = data.linkLabel || data.link_label || '访问友联';
        this.index = index;
        this.kind = 'satellite';
        this.style = 'friend';
        this.orbitR = settings.GLOBE_R + settings.SAT_ORBIT_BASE + (index % 3) * settings.SAT_ORBIT_STEP;
        this.orbitAngle = (index / Math.max(total, 1)) * Math.PI * 2 + Math.random() * 0.5;
        this.orbitTilt = 0.45 + (index % 4) * 0.2;
        this.orbitSpeed = 0.011 + (index % 5) * 0.0035;
        this.pos = new Vector(0, 0, 0);
        this.screen = null;
        this.hover = false;
        this.active = false;
        this.pulse = Math.random() * Math.PI * 2;
        this.avatarImg = null;
        this.isFriend = true;
        this.updatePosition();
    }

    EarthSatellite.prototype.updatePosition = function () {
        var a = this.orbitAngle;
        var r = this.orbitR;
        this.pos.x = r * Math.cos(a);
        this.pos.y = r * Math.sin(a) * Math.sin(this.orbitTilt);
        this.pos.z = r * Math.sin(a) * Math.cos(this.orbitTilt);
    };

    EarthSatellite.prototype.step = function () {
        this.orbitAngle += this.orbitSpeed;
        this.pulse += 0.05;
        this.updatePosition();
    };

    EarthSatellite.prototype.project = function (cx, cy) {
        if (this.pos.z > 18) {
            this.screen = null;
            return null;
        }
        var scale = settings.FOV / (settings.FOV + this.pos.z);
        this.screen = {
            x: this.pos.x * scale + cx,
            y: this.pos.y * scale + cy,
            scale: scale,
            z: this.pos.z
        };
        return this.screen;
    };

    EarthSatellite.prototype.draw = function (ctx, cx, cy) {
        var p = this.project(cx, cy);
        if (!p) {
            return;
        }

        var base = 8 + p.scale * 3.5;
        var pulse = 0.58 + Math.sin(this.pulse) * 0.26;
        var alpha = this.active ? 1 : (this.hover ? 0.98 : 0.86);
        var palette = SPOT_PALETTES.friend;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(' + palette.ring + ', ' + (0.32 + pulse * 0.22) + ')';
        ctx.lineWidth = 1.5;
        ctx.arc(p.x, p.y, base + 5 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();

        if (this.avatarImg && this.avatarImg.complete && this.avatarImg.naturalWidth > 0) {
            var avatarR = base * 0.95;
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, avatarR, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(this.avatarImg, p.x - avatarR, p.y - avatarR, avatarR * 2, avatarR * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(' + palette.ring + ', ' + (0.8 + pulse * 0.15) + ')';
            ctx.lineWidth = 1.8;
            ctx.arc(p.x, p.y, avatarR + 1.2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(' + palette.glow + ', ' + (alpha * 0.5) + ')';
            ctx.arc(p.x, p.y, base + 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.fillStyle = palette.core;
            ctx.globalAlpha = alpha;
            ctx.arc(p.x, p.y, base * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    };

    EarthSatellite.prototype.hitRadius = function () {
        if (!this.screen) {
            return 0;
        }
        return 24 + this.screen.scale * 5;
    };

    function zSort(a, b) {
        return (b.pos ? b.pos.z : 0) - (a.pos ? a.pos.z : 0);
    }

    var REVEAL_HOLD_MS = 4800;
    var REVERT_ANIM_MS = 2800;

    function SkyTextLayer(layer) {
        this.layer = layer;
        this.nodes = [];
        this.revertTimer = null;
        this.finishTimer = null;
        this.activeSpot = null;
    }

    SkyTextLayer.prototype.clearTimers = function () {
        if (this.revertTimer) {
            clearTimeout(this.revertTimer);
            this.revertTimer = null;
        }
        if (this.finishTimer) {
            clearTimeout(this.finishTimer);
            this.finishTimer = null;
        }
    };

    SkyTextLayer.prototype.reset = function () {
        this.clearTimers();
        this.activeSpot = null;
        if (this.layer) {
            this.layer.innerHTML = '';
        }
        this.nodes = [];
    };

    SkyTextLayer.prototype.createCard = function (item, index, kind) {
        var el = document.createElement('article');
        var isSatellite = kind === 'satellite';
        el.className = 'fp-sky-text fp-spot-' + item.style + ' is-star' + (isSatellite ? ' is-friend-link' : '');
        el.setAttribute('data-spot-index', String(index));
        el.setAttribute('data-spot-kind', kind);

        var starX = (10 + Math.random() * 80).toFixed(2) + '%';
        var starY = (8 + Math.random() * 48).toFixed(2) + '%';
        el.style.setProperty('--fp-sky-x', starX);
        el.style.setProperty('--fp-sky-y', starY);
        el.dataset.starX = starX;
        el.dataset.starY = starY;
        el.style.animationDelay = (Math.random() * 2.5).toFixed(2) + 's';

        if (isSatellite) {
            var badge = document.createElement('span');
            badge.className = 'fp-sky-text-friend-badge';
            badge.textContent = '友联';
            el.appendChild(badge);
        }

        if (isSatellite && item.avatar) {
            var avatar = document.createElement('img');
            avatar.className = 'fp-sky-text-avatar';
            avatar.src = item.avatar;
            avatar.alt = item.title || '';
            avatar.width = 72;
            avatar.height = 72;
            avatar.loading = 'lazy';
            avatar.decoding = 'async';
            el.appendChild(avatar);
        }

        if (item.title) {
            var title = document.createElement('strong');
            title.className = 'fp-sky-text-title';
            title.textContent = item.title;
            el.appendChild(title);
        }

        if (item.text) {
            var body = document.createElement('p');
            body.className = 'fp-sky-text-body';
            body.textContent = item.text;
            el.appendChild(body);
        }

        if (item.url) {
            var link = document.createElement('a');
            link.className = 'fp-sky-text-link';
            link.href = item.url;
            link.textContent = item.linkLabel || (isSatellite ? '访问友联' : '查看链接');
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('data-no-pjax', '1');
            el.appendChild(link);
        }

        this.layer.appendChild(el);
        item.starEl = el;
        this.nodes.push(el);
    };

    SkyTextLayer.prototype.build = function (spots, satellites) {
        this.reset();
        if (!this.layer) {
            return;
        }

        var i;
        for (i = 0; i < spots.length; i++) {
            this.createCard(spots[i], i, 'spot');
        }
        for (i = 0; i < satellites.length; i++) {
            this.createCard(satellites[i], i, 'satellite');
        }
    };

    SkyTextLayer.prototype.applyStarState = function (el) {
        if (!el) {
            return;
        }
        el.classList.remove('is-revealed', 'is-reverting');
        el.classList.add('is-star');
        el.style.setProperty('--fp-sky-x', el.dataset.starX || '50%');
        el.style.setProperty('--fp-sky-y', el.dataset.starY || '30%');
        el.style.setProperty('--fp-sky-scale', '0.1');
        el.style.setProperty('--fp-sky-opacity', '0.42');
        el.style.setProperty('--fp-sky-blur', '0.4px');
    };

    SkyTextLayer.prototype.reveal = function (spot) {
        if (!spot || !spot.starEl) {
            return;
        }

        this.clearTimers();

        var i;
        for (i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i] !== spot.starEl) {
                this.applyStarState(this.nodes[i]);
            }
        }

        var el = spot.starEl;
        el.classList.remove('is-star', 'is-reverting');
        el.classList.add('is-revealed');
        el.style.setProperty('--fp-sky-x', '50%');
        el.style.setProperty('--fp-sky-y', '34%');
        el.style.setProperty('--fp-sky-scale', '1');
        el.style.setProperty('--fp-sky-opacity', '1');
        el.style.setProperty('--fp-sky-blur', '0');

        this.activeSpot = spot;
        var that = this;
        this.revertTimer = setTimeout(function () {
            that.startRevert(spot);
        }, REVEAL_HOLD_MS);
    };

    SkyTextLayer.prototype.startRevert = function (spot) {
        if (!spot || !spot.starEl) {
            return;
        }

        var el = spot.starEl;
        el.classList.remove('is-revealed');
        el.classList.add('is-reverting');
        el.style.setProperty('--fp-sky-x', el.dataset.starX || '50%');
        el.style.setProperty('--fp-sky-y', el.dataset.starY || '30%');
        el.style.setProperty('--fp-sky-scale', '0.1');
        el.style.setProperty('--fp-sky-opacity', '0.42');
        el.style.setProperty('--fp-sky-blur', '0.4px');

        var that = this;
        this.finishTimer = setTimeout(function () {
            that.applyStarState(el);
            if (that.activeSpot === spot) {
                that.activeSpot = null;
            }
        }, REVERT_ANIM_MS);
    };

    SkyTextLayer.prototype.dismiss = function (immediate) {
        this.clearTimers();
        if (!this.activeSpot || !this.activeSpot.starEl) {
            return;
        }

        if (immediate) {
            this.applyStarState(this.activeSpot.starEl);
            this.activeSpot = null;
            return;
        }

        this.startRevert(this.activeSpot);
    };

    function Scene(canvas) {
        this.canvas = canvas;
        this.points = [];
        this.clouds = [];
        this.spots = [];
        this.satellites = [];
        this.animationFrame = 0;
        this.running = false;
        this.frameCount = 0;
        this.hoveredTarget = null;
        this.activeTarget = null;
        this.skyTexts = new SkyTextLayer(document.getElementById('fpSkyTexts'));
        this.bindUi();
        this.seed();
    }

    Scene.prototype.bindUi = function () {
        var that = this;

        this.onPointer = function (event) {
            if (event.type === 'touchstart') {
                return;
            }
            var clientX = event.clientX;
            var clientY = event.clientY;
            if (event.type === 'touchend' && event.changedTouches && event.changedTouches[0]) {
                clientX = event.changedTouches[0].clientX;
                clientY = event.changedTouches[0].clientY;
            }
            var target = that.pickTarget(clientX, clientY);
            that.hoveredTarget = target;
            that.canvas.style.cursor = target ? 'pointer' : 'default';
        };

        this.onClick = function (event) {
            var clientX = event.clientX;
            var clientY = event.clientY;
            if (event.type === 'touchend') {
                if (event.changedTouches && event.changedTouches[0]) {
                    clientX = event.changedTouches[0].clientX;
                    clientY = event.changedTouches[0].clientY;
                }
                event.preventDefault();
            }
            var target = that.pickTarget(clientX, clientY);
            if (target) {
                that.setActiveTarget(target);
            } else if (that.activeTarget) {
                that.setActiveTarget(null);
            }
        };

        this.onLeave = function () {
            that.hoveredTarget = null;
            that.canvas.style.cursor = 'default';
        };

        this.canvas.addEventListener('click', this.onClick);
        this.canvas.addEventListener('mousemove', this.onPointer);
        this.canvas.addEventListener('mouseleave', this.onLeave);
        this.canvas.addEventListener('touchend', this.onClick, { passive: false });
        this.canvas.addEventListener('touchstart', this.onPointer, { passive: true });
    };

    Scene.prototype.unbindUi = function () {
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('mousemove', this.onPointer);
        this.canvas.removeEventListener('mouseleave', this.onLeave);
        this.canvas.removeEventListener('touchend', this.onClick);
        this.canvas.removeEventListener('touchstart', this.onPointer);
    };

    Scene.prototype.ensureCtx = function () {
        this.ctx = this.canvas.getContext('2d');
        return this.ctx;
    };

    Scene.prototype.syncPointsCtx = function () {
        var i;
        for (i = 0; i < this.points.length; i++) {
            this.points[i].ctx = this.ctx;
        }
    };

    Scene.prototype.setSize = function () {
        var w = window.innerWidth;
        var h = window.innerHeight;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        this.logicalW = w;
        this.logicalH = h;
        this.ensureCtx();
        this.syncPointsCtx();
    };

    Scene.prototype.seed = function () {
        this.setSize();
        this.points = [];
        this.clouds = [];
        this.spots = [];
        this.satellites = [];

        var R = settings.GLOBE_R;
        var landTarget = 900;
        var oceanTarget = 650;
        var landCount = 0;
        var oceanCount = 0;
        var guard = 0;

        while ((landCount < landTarget || oceanCount < oceanTarget) && guard < 20000) {
            guard++;
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.acos(Math.random() * 2 - 1);
            var vec = new Vector(
                R * Math.sin(phi) * Math.cos(theta),
                R * Math.sin(phi) * Math.sin(theta),
                R * Math.cos(phi)
            );
            var geo = vectorToLatLng(vec);
            var onLand = isLandAt(geo.lng, geo.lat);

            if (onLand && landCount >= landTarget) {
                continue;
            }
            if (!onLand && oceanCount >= oceanTarget) {
                continue;
            }

            var point = new Point(vec, new Vector(), this.ctx);
            if (onLand) {
                point.type = 'land';
                point.color = pick(landColors);
                point.size = 2.2 + Math.random() * 1.6;
                landCount++;
            } else {
                point.type = 'ocean';
                point.color = pick(oceanColors);
                point.size = 1 + Math.random() * 0.8;
                oceanCount++;
            }
            this.points.push(point);
        }

        var i;
        for (i = 0; i < 90; i++) {
            var cTheta = Math.random() * Math.PI * 2;
            var cPhi = Math.acos(Math.random() * 2 - 1);
            var cVec = new Vector(
                (R + 24) * Math.sin(cPhi) * Math.cos(cTheta),
                (R + 24) * Math.sin(cPhi) * Math.sin(cTheta),
                (R + 24) * Math.cos(cPhi)
            );
            var sign = Math.random() > 0.5 ? 1 : -1;
            var cloud = new Point(cVec, new Vector(sign * Math.random() / 220, sign * Math.random() / 220, 0), this.ctx);
            cloud.type = 'cloud';
            cloud.size = 4.5;
            this.clouds.push(cloud);
        }

        if (Array.isArray(earthConfig.spots)) {
            earthConfig.spots.forEach(function (item, index) {
                if (!item) {
                    return;
                }
                var lat = parseFloat(item.lat);
                var lng = parseFloat(item.lng);
                if (isNaN(lat) || isNaN(lng)) {
                    return;
                }
                this.spots.push(new EarthSpot({
                    lat: lat,
                    lng: lng,
                    title: item.title || item.label || '',
                    text: item.text || item.desc || item.description || '',
                    style: item.style || 'star',
                    url: item.url || '',
                    link_label: item.link_label || item.linkLabel || '',
                    index: index
                }));
            }, this);
        }

        var friends = Array.isArray(earthConfig.friends) ? earthConfig.friends : [];
        friends.forEach(function (item, index) {
            if (!item) {
                return;
            }
            var sat = new EarthSatellite({
                title: item.title || item.name || '',
                text: item.text || item.desc || '',
                url: item.url || '',
                avatar: item.avatar || '',
                link_label: item.link_label || item.linkLabel || ''
            }, index, friends.length);
            this.satellites.push(sat);
            if (sat.avatar) {
                avatarCache.load(sat.avatar, function (img) {
                    sat.avatarImg = img;
                });
            }
        }, this);

        this.skyTexts.build(this.spots, this.satellites);
    };

    Scene.prototype.drawAtmosphere = function (cx, cy) {
        var ctx = this.ctx;
        var glow = ctx.createRadialGradient(cx, cy, settings.GLOBE_R * 0.2, cx, cy, settings.GLOBE_R * 1.55);
        glow.addColorStop(0, 'rgba(40, 120, 200, 0.08)');
        glow.addColorStop(0.55, 'rgba(20, 80, 160, 0.12)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, settings.GLOBE_R * 1.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(120, 190, 255, 0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, settings.GLOBE_R * 1.02, 0, Math.PI * 2);
        ctx.stroke();

        if (this.satellites.length) {
            var orbitVisual = settings.GLOBE_R + settings.SAT_ORBIT_BASE + settings.SAT_ORBIT_STEP;
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 190, 130, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 8]);
            ctx.beginPath();
            ctx.ellipse(cx, cy, orbitVisual, orbitVisual * 0.62, 0.35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    };

    Scene.prototype.pickTarget = function (clientX, clientY) {
        var rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return null;
        }

        var scaleX = this.logicalW / rect.width;
        var scaleY = this.logicalH / rect.height;
        var x = (clientX - rect.left) * scaleX;
        var y = (clientY - rect.top) * scaleY;
        var cx = this.logicalW / 2;
        var cy = this.logicalH / 2;
        var best = null;
        var bestScore = Infinity;
        var groups = [this.satellites, this.spots];
        var g;
        var i;

        for (g = 0; g < groups.length; g++) {
            for (i = 0; i < groups[g].length; i++) {
                var item = groups[g][i];
                var p = item.project(cx, cy);
                if (!p) {
                    continue;
                }
                var dx = x - p.x;
                var dy = y - p.y;
                var dist2 = dx * dx + dy * dy;
                var radius = Math.max(item.hitRadius(), 18);
                if (dist2 <= radius * radius) {
                    var score = dist2 + p.z * 12;
                    if (score < bestScore) {
                        best = item;
                        bestScore = score;
                    }
                }
            }
        }

        return best;
    };

    Scene.prototype.revealSpotByIndex = function (index) {
        if (!this.spots.length || index < 0 || index >= this.spots.length) {
            return false;
        }
        this.setActiveTarget(this.spots[index]);
        return true;
    };

    Scene.prototype.revealFriendByIndex = function (index) {
        if (!this.satellites.length || index < 0 || index >= this.satellites.length) {
            return false;
        }
        this.setActiveTarget(this.satellites[index]);
        return true;
    };

    Scene.prototype.getSpotSummaries = function () {
        var i;
        var list = [];
        for (i = 0; i < this.spots.length; i++) {
            var spot = this.spots[i];
            list.push({
                index: i,
                title: spot.title,
                text: spot.text,
                style: spot.style,
                url: spot.url,
                linkLabel: spot.linkLabel,
                kind: 'spot',
                lat: spot.lat,
                lng: spot.lng
            });
        }
        return list;
    };

    Scene.prototype.getFriendSummaries = function () {
        var i;
        var list = [];
        for (i = 0; i < this.satellites.length; i++) {
            var sat = this.satellites[i];
            list.push({
                index: i,
                title: sat.title,
                text: sat.text,
                style: sat.style,
                url: sat.url,
                avatar: sat.avatar,
                linkLabel: sat.linkLabel,
                kind: 'satellite',
                isFriend: true
            });
        }
        return list;
    };

    Scene.prototype.setActiveTarget = function (target) {
        var i;

        if (this.activeTarget && this.activeTarget !== target) {
            this.skyTexts.dismiss(true);
        }

        this.activeTarget = target || null;

        for (i = 0; i < this.spots.length; i++) {
            this.spots[i].active = this.spots[i] === target;
        }
        for (i = 0; i < this.satellites.length; i++) {
            this.satellites[i].active = this.satellites[i] === target;
        }

        if (target) {
            this.skyTexts.reveal(target);
        } else {
            this.skyTexts.dismiss(false);
        }
    };

    Scene.prototype.update = function () {
        var i;
        var cx = this.logicalW / 2;
        var cy = this.logicalH / 2;

        this.ensureCtx();
        this.syncPointsCtx();
        this.ctx.clearRect(0, 0, this.logicalW, this.logicalH);

        this.drawAtmosphere(cx, cy);

        for (i = 0; i < this.points.length; i++) {
            this.points[i].step();
        }
        for (i = 0; i < this.clouds.length; i++) {
            var cloud = this.clouds[i];
            cloud.step(this.clouds);
            cloud.history.push({ x: cloud.pos.x, y: cloud.pos.y, z: cloud.pos.z });
            if (cloud.history.length > 12) {
                cloud.history.shift();
            }
        }
        for (i = 0; i < this.spots.length; i++) {
            this.spots[i].step();
            this.spots[i].hover = this.spots[i] === this.hoveredTarget;
        }
        for (i = 0; i < this.satellites.length; i++) {
            this.satellites[i].step();
            this.satellites[i].hover = this.satellites[i] === this.hoveredTarget;
        }

        var drawables = this.points.concat(this.clouds).sort(zSort);
        for (i = 0; i < drawables.length; i++) {
            drawables[i].draw(cx, cy);
        }

        var visibleSpots = this.spots.slice().sort(zSort);
        for (i = 0; i < visibleSpots.length; i++) {
            visibleSpots[i].draw(this.ctx, cx, cy);
        }

        var visibleSats = this.satellites.slice().sort(zSort);
        for (i = 0; i < visibleSats.length; i++) {
            visibleSats[i].draw(this.ctx, cx, cy);
        }

        this.frameCount++;
    };

    Scene.prototype.animate = function () {
        var that = this;
        if (!this.running) {
            return;
        }
        this.animationFrame = window.requestAnimationFrame(function () {
            that.animate();
        });
        this.update();
    };

    Scene.prototype.enable = function () {
        var that = this;
        this.running = true;
        this.animate();

        var endResize;
        window.addEventListener('resize', function () {
            clearTimeout(endResize);
            endResize = setTimeout(function () {
                that.seed();
            }, 120);
        });
        return this;
    };

    Scene.prototype.disable = function () {
        this.running = false;
        window.cancelAnimationFrame(this.animationFrame);
        this.unbindUi();
        this.skyTexts.dismiss(true);
        this.activeTarget = null;
        return this;
    };

    var activeScene = null;

    function bootEarth(canvas) {
        if (!canvas) {
            return null;
        }
        if (canvas.dataset.earthReady === '1' && activeScene && activeScene.running) {
            return activeScene;
        }

        if (activeScene) {
            activeScene.disable();
        }

        canvas.dataset.earthReady = '1';
        canvas.classList.add('fp-earth-interactive');
        var hasSpots = Array.isArray(earthConfig.spots) && earthConfig.spots.length;
        var hasFriends = Array.isArray(earthConfig.friends) && earthConfig.friends.length;
        if (hasSpots || hasFriends) {
            canvas.classList.add('fp-earth-has-spots');
            canvas.setAttribute('aria-hidden', 'false');
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', '可点击的粒子地球');
        }

        activeScene = new Scene(canvas);
        activeScene.enable();
        return activeScene;
    }

/**
 * @param {HTMLCanvasElement} canvas
 * @param {EarthConfig} config
 */
export function initEarthScene(canvas, config) {
    setEarthConfig(config);
    return bootEarth(canvas);
}

export function revealSpotByIndex(index) {
    if (!activeScene) {
        return false;
    }
    return activeScene.revealSpotByIndex(index);
}

export function revealFriendByIndex(index) {
    if (!activeScene) {
        return false;
    }
    return activeScene.revealFriendByIndex(index);
}

export function getEarthSpots() {
    if (!activeScene) {
        return (earthConfig.spots || []).map(function (item, index) {
            return {
                index: index,
                title: item.title || '',
                text: item.text || '',
                style: normalizeSpotStyle(item.style),
                url: item.url || '',
                linkLabel: item.link_label || item.linkLabel || '',
                kind: 'spot',
                lat: item.lat,
                lng: item.lng
            };
        });
    }
    return activeScene.getSpotSummaries();
}

export function getEarthFriends() {
    if (!activeScene) {
        return (earthConfig.friends || []).map(function (item, index) {
            return {
                index: index,
                title: item.title || '',
                text: item.text || '',
                style: 'friend',
                url: item.url || '',
                avatar: item.avatar || '',
                linkLabel: item.link_label || item.linkLabel || '',
                kind: 'satellite',
                isFriend: true
            };
        });
    }
    return activeScene.getFriendSummaries();
}

/** @param {HTMLCanvasElement} canvas @param {EarthConfig} config */
export function destroyEarthScene(canvas) {
    if (activeScene) {
        activeScene.disable();
        activeScene = null;
    }
    if (canvas) {
        delete canvas.dataset.earthReady;
        canvas.classList.remove('fp-earth-has-spots', 'fp-earth-interactive');
    }
}
