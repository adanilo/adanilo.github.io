/*
    Copyright 2021 Alex Danilo
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
        http://www.apache.org/licenses/LICENSE-2.0
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

const canvas = document.querySelector('#surface');
const ctx = canvas.getContext('2d', { alpha: false });
let vdz_world = null;
let vdz_view = null;
let wasm_loaded = false;

Module.onRuntimeInitialized = function () {
    vdz_world = Module._World_new();
    if (vdz_world) {
        Module._World_set_log_level(vdz_world, 0);
        vdz_view = Module._World_View_new(vdz_world);
        if (vdz_view) {
            Module._WV_set_width(vdz_view, canvas.width);
            Module._WV_set_height(vdz_view, canvas.height);
            wasm_loaded = true;
        }
    }
    document.vdz_ready = 'READY';
}

// Pump an array buffer into the render engine.
function vdz_load(image) {
    if (wasm_loaded === false) {
        console.log("Wasm renderer not loaded");
        return;
    }
    const len = image.byteLength;
    const buf = Module._malloc(len);
    Module.HEAPU8.set(new Uint8Array(image), buf);
    Module._WV_load_raw_bytes(vdz_view, buf, len);
    Module._WV_paint(vdz_view);
}

function vdz_load_resource(path) {
    document.vdz_load_pending = true;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);

    xhr.responseType = 'arraybuffer';
    xhr.onload = function (e) {
        if (this.status == 200) {
            vdz_load(this.response);
            document.vdz_load_pending = false;
        }
    };
    xhr.send();
}

// File open handling (brute force - one Blob).
function handleFileSelect(evt) {
    var files = evt.target.files; // FileList object

    // files is a FileList of File objects. grab the name.
    if (files[0]) {
        var f = files[0];
        var reader = new FileReader();
        // Closure to capture the file information.
        reader.onload = (function (theFile) {
            return function (e) {
                vdz_load(e.target.result);
            };
        })(f);

        // Read in the image file as an array buffer.
        reader.readAsArrayBuffer(f);
    }
}
document.getElementById('files').addEventListener('change', handleFileSelect, false);

const enable_logging = false;

function LOG(s) {
    if (enable_logging) {
        console.log(s);
    }
}

function vdz_eraseCanvas() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    //ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Turning off transparent canvas means we need to fill with white.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    LOG('Erase');
}

function vdz_setTransform(a, b, c, d, e, f) {
    ctx.setTransform(a, b, c, d, e, f);
    LOG('Set Xform:' + a + ', ' + b + ', ' + c + ', ' + d + ', ' + e + ', ' + f);
}

function vdz_beginPath() {
    ctx.beginPath();
    LOG('Begin Path');
}

function vdz_moveTo(x, y) {
    ctx.moveTo(x, y);
    LOG('MoveTo ' + x + ', ' + y);
}

function vdz_lineTo(x, y) {
    ctx.lineTo(x, y);
    LOG('LineTo ' + x + ', ' + y);
}

function vdz_bezTo(c1x, c1y, c2x, c2y, ex, ey) {
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    LOG('BezTo ' + c1x + ', ' + c1y + ', ' + c2x + ', ' + c2y + ', ' + ex + ', ' + ey);
}

function vdz_closePath() {
    ctx.closePath();
    LOG('ClosePath');
}

function vdz_set_fill_color(r, g, b, a) {
    if (a < 1) {
        ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ',' + a + ')';
    } else {
        ctx.fillStyle = 'rgb(' + r + ', ' + g + ', ' + b + ')';
    }
    LOG('Set Fill ' + ctx.fillStyle);
}

function vdz_set_stroke_color(r, g, b, a) {
    if (a < 1) {
        ctx.strokeStyle = 'rgba(' + r + ', ' + g + ', ' + b + ',' + a + ')';
    } else {
        ctx.strokeStyle = 'rgb(' + r + ', ' + g + ', ' + b + ')';
    }
    LOG('Set Stroke ' + ctx.strokeStyle);
}

function vdz_set_color(fill, r, g, b, a) {
    if (fill) {
        vdz_set_fill_color(r, g, b, a);
    } else {
        vdz_set_stroke_color(r, g, b, a);
    }
}

let gradientHolder = null;

function vdz_createLinearGradient(x0, y0, x1, y1) {
    gradientHolder = ctx.createLinearGradient(x0, y0, x1, y1);
    LOG("VCLG x0,y0 " + x0 + ',' + y0 + ' x2,y2 ' + x1 + ',' + y1);
}

function vdz_createRadialGradient(x0, y0, r0, x1, y1, r1) {
    gradientHolder = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    LOG("VCRG x0,y0,r0 " + x0 + ',' + y0 + ',' + r0 + ' x1, y1, r1 ' + x1 + ',' + y1 + ',' + r1);
}

function vdz_gradientAddStop(pos, r, g, b, a) {
    gradientHolder.addColorStop(pos, 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')');
    LOG('Col stop at ' + pos + ', rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')');
}

function vdz_setGradient(fill) {
    if (fill) {
        ctx.fillStyle = gradientHolder;
    } else {
        ctx.strokeStyle = gradientHolder;
    }
}

function vdz_set_stroke_width(w) {
    LOG('StrokeW: ' + w);
    ctx.lineWidth = w;
}

function vdz_fill(evenodd) {
    LOG('Fill poly');
    if (evenodd) {
        ctx.fill('evenodd');
    } else {
        ctx.fill();
    }
}

function vdz_stroke() {
    LOG('Stroke poly');
    ctx.stroke();
}

function vdz_font_size(size) {
    ctx.font = size + 'px sans-serif';
    LOG('Font: ' + ctx.font);
}

function vdz_draw_text(s, x, y, fill) {
    LOG('Pre-text xform: ' + ctx.getTransform());
    if (fill) {
        ctx.fillText(s, x, y);
        LOG('FT: ' + s + ' at ' + x + ', ' + y);
    } else {
        ctx.strokeText(s, x, y);
        LOG('ST: ' + s + ' at ' + x + ', ' + y);
    }
}

function vdz_text_width(s) {
    const metrics = ctx.measureText(s);

    return metrics.width;
}

function vdz_text_height() {
    const metrics = ctx.measureText('Xj');

    return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
}

function vdz_text_baseline() {
    const metrics = ctx.measureText('Xj');

    return metrics.actualBoundingBoxAscent;
}
