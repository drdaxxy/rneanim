var SceGxmTextureType = {
    Swizzled: 0x00000000 | 0,
    Cube: 0x40000000 | 0,
    Linear: 0x60000000 | 0,
    Tiled: 0x80000000 | 0,
    SwizzledArbitrary: 0xA0000000 | 0,
    LinearStrided: 0xC0000000 | 0,
    CubeArbitrary: 0xE0000000 | 0
};

var SceGxmTextureBaseFormat = {
    U8           : 0x00000000 | 0,
    S8           : 0x01000000 | 0,
    U4U4U4U4     : 0x02000000 | 0,
    U8U3U3U2     : 0x03000000 | 0,
    U1U5U5U5     : 0x04000000 | 0,
    U5U6U5       : 0x05000000 | 0,
    S5S5U6       : 0x06000000 | 0,
    U8U8         : 0x07000000 | 0,
    S8S8         : 0x08000000 | 0,
    U16          : 0x09000000 | 0,
    S16          : 0x0A000000 | 0,
    F16          : 0x0B000000 | 0,
    U8U8U8U8     : 0x0C000000 | 0,
    S8S8S8S8     : 0x0D000000 | 0,
    U2U10U10U10  : 0x0E000000 | 0,
    U16U16       : 0x0F000000 | 0,
    S16S16       : 0x10000000 | 0,
    F16F16       : 0x11000000 | 0,
    F32          : 0x12000000 | 0,
    F32M         : 0x13000000 | 0,
    X8S8S8U8     : 0x14000000 | 0,
    X8U24        : 0x15000000 | 0,
    U32          : 0x17000000 | 0,
    S32          : 0x18000000 | 0,
    SE5M9M9M9    : 0x19000000 | 0,
    F11F11F10    : 0x1A000000 | 0,
    F16F16F16F16 : 0x1B000000 | 0,
    U16U16U16U16 : 0x1C000000 | 0,
    S16S16S16S16 : 0x1D000000 | 0,
    F32F32       : 0x1E000000 | 0,
    U32U32       : 0x1F000000 | 0,
    PVRT2BPP     : 0x80000000 | 0,
    PVRT4BPP     : 0x81000000 | 0,
    PVRTII2BPP   : 0x82000000 | 0,
    PVRTII4BPP   : 0x83000000 | 0,
    UBC1         : 0x85000000 | 0,
    UBC2         : 0x86000000 | 0,
    UBC3         : 0x87000000 | 0,
    YUV420P2     : 0x90000000 | 0,
    YUV420P3     : 0x91000000 | 0,
    YUV422       : 0x92000000 | 0,
    P4           : 0x94000000 | 0,
    P8           : 0x95000000 | 0,
    U8U8U8       : 0x98000000 | 0,
    S8S8S8       : 0x99000000 | 0,
    U2F10F10F10  : 0x9A000000 | 0
};

var SceGxmTextureSwizzle4Mode = {
    ABGR   : 0x00000000 | 0,
    ARGB   : 0x00001000 | 0,
    RGBA   : 0x00002000 | 0,
    BGRA   : 0x00003000 | 0,
    _1BGR   : 0x00004000 | 0,
    _1RGB   : 0x00005000 | 0,
    RGB1   : 0x00006000 | 0,
    BGR1   : 0x00007000 | 0
};

var SceGxmTextureSwizzle3Mode = {
    BGR : 0x0000 | 0,
    RGB : 0x1000 | 0
};

GXTLoader = function ( manager ) {

    this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

GXTLoader.prototype = {

    constructor: GXTLoader,

    load: function(url, onLoad, onProgress, onError) {
        var scope = this;

        var loader = new THREE.FileLoader( this.manager );
        loader.setResponseType( 'arraybuffer' );
        loader.load( url, function ( buffer ) {

            onLoad( scope.parse( buffer ) );

        }, onProgress, onError );
    },

    parse: function ( buffer ) {

        function decimalToHex(d, padding) {
            var hex = d.toString(16).toUpperCase();
            padding = padding ? padding : 2;

            while (hex.length < padding) {
                hex = "0" + hex;
            }

            return hex;
        }

        // Vita unswizzle
        //
        // Thanks @xdanieldzd, @FireyFly and ryg
        // https://github.com/xdanieldzd/Scarlet/blob/d8aabf430307d35a81b131e40bb3c9a4828bdd7b/Scarlet/Drawing/ImageBinary.cs
        // http://xen.firefly.nu/up/rearrange.c.html
        // https://fgiesen.wordpress.com/2009/12/13/decoding-morton-codes/

        function Compact1By1(x)
        {
            x &= 0x55555555;                    // x = -f-e -d-c -b-a -9-8 -7-6 -5-4 -3-2 -1-0
            x = (x ^ (x >> 1)) & 0x33333333;    // x = --fe --dc --ba --98 --76 --54 --32 --10
            x = (x ^ (x >> 2)) & 0x0f0f0f0f;    // x = ---- fedc ---- ba98 ---- 7654 ---- 3210
            x = (x ^ (x >> 4)) & 0x00ff00ff;    // x = ---- ---- fedc ba98 ---- ---- 7654 3210
            x = (x ^ (x >> 8)) & 0x0000ffff;    // x = ---- ---- ---- ---- fedc ba98 7654 3210
            return x;
        }

        function DecodeMorton2X(code)
        {
            return Compact1By1(code >> 0);
        }

        function DecodeMorton2Y(code)
        {
            return Compact1By1(code >> 1);
        }

        function unswizzle(origX, origY, width, height)
        {

            // TODO: verify this is even sensible
            if (width == 0) width = 16;
            if (height == 0) height = 16;

            var i = (origY * width) + origX;

            var min = width < height ? width : height;
            var k = Math.floor(Math.log2(min));

            if (height < width)
            {
                // XXXyxyxyx → XXXxxxyyy
                var j = i >> (2 * k) << (2 * k)
                    | (DecodeMorton2Y(i) & (min - 1)) << k
                    | (DecodeMorton2X(i) & (min - 1)) << 0;
                return {x: Math.floor(j / height), y: j % height};
            }
            else
            {
                // YYYyxyxyx → YYYyyyxxx
                var j = i >> (2 * k) << (2 * k)
                    | (DecodeMorton2X(i) & (min - 1)) << k
                    | (DecodeMorton2Y(i) & (min - 1)) << 0;
                return {x: j % width, y: Math.floor(j / width)};
            }
        }

        // DXT1 decoding
        // https://github.com/Benjamin-Dobell/s3tc-dxt-decompression

        function DecompressBlockDXT1(x, y, width, height, imageData, isSwizzled) {
            var color0 = reader.getUint16(pos, true); pos += 2;
            var color1 = reader.getUint16(pos, true); pos += 2;

            var temp;

            temp = (color0 >> 11) * 255 + 16;
            var r0 = Math.floor((Math.floor(temp/32) + temp)/32) & 0x000000FF;
            temp = ((color0 & 0x07E0) >> 5) * 255 + 32;
            var g0 = Math.floor((Math.floor(temp/64) + temp)/64) & 0x000000FF;
            temp = (color0 & 0x001F) * 255 + 16;
            var b0 = Math.floor((Math.floor(temp/32) + temp)/32) & 0x000000FF;
            
            temp = (color1 >> 11) * 255 + 16;
            var r1 = Math.floor((Math.floor(temp/32) + temp)/32) & 0x000000FF;
            temp = ((color1 & 0x07E0) >> 5) * 255 + 32;
            var g1 = Math.floor((Math.floor(temp/64) + temp)/64) & 0x000000FF;
            temp = (color1 & 0x001F) * 255 + 16;
            var b1 = Math.floor((Math.floor(temp/32) + temp)/32) & 0x000000FF;

            var code = reader.getUint32(pos, true); pos += 4;

            var finalColor;

            for (var j = 0; j < 4; j++) {
                for (var i = 0; i < 4; i++) {
                    var positionCode = (code >>  2*(4*j+i)) & 0x03;
                    if (color0 > color1) {
                        switch (positionCode) {
                            case 0:
                                finalColor = {r: r0, g: g0, b: b0};
                                break;
                            case 1:
                                finalColor = {r: r1, g: g1, b: b1};
                                break;
                            case 2:
                                finalColor = {r: Math.floor((2*r0+r1)/3), g: Math.floor((2*g0+g1)/3), b: Math.floor((2*b0+b1)/3)};
                                break;
                            case 3:
                                finalColor = {r: Math.floor((r0+2*r1)/3), g: Math.floor((g0+2*g1)/3), b: Math.floor((b0+2*b1)/3)};
                                break;
                        }
                    } else {
                        switch (positionCode) {
                            case 0:
                                finalColor = {r: r0, g: g0, b: b0};
                                break;
                            case 1:
                                finalColor = {r: r1, g: g1, b: b1};
                                break;
                            case 2:
                                finalColor = {r: Math.floor((r0+r1)/2), g: Math.floor((g0+g1)/2), b: Math.floor((b0+b1)/2)};
                                break;
                            case 3:
                                finalColor = {r: 0, g: 0, b: 0};
                                break;
                        }
                    }

                    var outX = x;
                    var outY = y;
                    if (isSwizzled) {
                        var unswizzled = unswizzle(x / 4, y / 4, width / 4, height / 4);
                        outX = unswizzled.x * 4;
                        outY = unswizzled.y * 4;
                    }

                    outX += i;
                    outY += j;

                    if (outX < width) {
                        imageData.data[(outX + width * outY) * 4 + 0] = finalColor.r;
                        imageData.data[(outX + width * outY) * 4 + 1] = finalColor.g;
                        imageData.data[(outX + width * outY) * 4 + 2] = finalColor.b;
                        imageData.data[(outX + width * outY) * 4 + 3] = 255;
                    }
                }
            }
        }

        var reader = new DataView(buffer);
        var pos = 0;

        pos += 4; // magic
        pos += 4; // version
        var subTexCount = reader.getUint32(pos, true); pos += 4;
        var subTexOffset = reader.getUint32(pos, true); pos += 4;
        var totalTexSize = reader.getUint32(pos, true); pos += 4;
        var p4Count = reader.getUint32(pos, true); pos += 4;
        var p8Count = reader.getUint32(pos, true); pos += 4;
        pos += 4; // padding

        var subTexHeaders = [];
        for (var i = 0; i < subTexCount; i++) {
            var subTexHeader = {};
            subTexHeader.offset = reader.getUint32(pos, true); pos += 4;
            subTexHeader.size = reader.getUint32(pos, true); pos += 4;
            subTexHeader.paletteIdx = reader.getUint32(pos, true); pos += 4;
            pos += 4; // flags/unused
            subTexHeader.pixelOrder = reader.getUint32(pos, true); pos += 4;
            subTexHeader.format = reader.getUint32(pos, true); pos += 4;
            subTexHeader.width = reader.getUint16(pos, true); pos += 2;
            subTexHeader.height = reader.getUint16(pos, true); pos += 2;
            subTexHeader.mipmapCount = reader.getUint16(pos, true); pos += 2;
            pos += 2; // padding?

            /*
            console.log("Subtexture: " + i);
            console.log("Palette: " + subTexHeader.paletteIdx);
            console.log("Pixel order: " + subTexHeader.pixelOrder);
            console.log("Texture format: " + decimalToHex(subTexHeader.format, 8));
            */

            subTexHeaders.push(subTexHeader);

            pos += subTexHeader.size;
        }
        var palettes = [];
        for (var i = 0; i < p4Count; i++)
        {
            var palette = [];
            for (var k = 0; k < 16; k++) {
                palette.push([reader.getUint8(pos), reader.getUint8(pos+1), reader.getUint8(pos+2), reader.getUint8(pos+3)]);
                pos += 4;
            }
            palettes.push(palette);
        }
        for (var i = 0; i < p8Count; i++)
        {
            var palette = [];
            for (var k = 0; k < 256; k++) {
                palette.push([reader.getUint8(pos), reader.getUint8(pos+1), reader.getUint8(pos+2), reader.getUint8(pos+3)]);
                pos += 4;
            }
            palettes.push(palette);
        }

        var subTextures = [];
        for (var i = 0; i < subTexCount; i++) {
            var canvas = document.createElement('canvas');
            canvas.width = subTexHeaders[i].width;
            canvas.height = subTexHeaders[i].height;
            var context = canvas.getContext('2d');
            var imageData = context.createImageData(canvas.width, canvas.height);

            pos = subTexHeaders[i].offset;
            var oldPos = pos;

            var baseFormat = subTexHeaders[i].format & 0xFF000000;
            var channelOrder = subTexHeaders[i].format & 0x0000FFFF;

            if (baseFormat == SceGxmTextureBaseFormat.U8U8U8) {
                for (var y = 0; y < canvas.height; y++) {
                    for (var x = 0; x < canvas.width; x++) {
                        var outX = x;
                        var outY = y;
                        if (subTexHeaders[i].pixelOrder == SceGxmTextureType.Swizzled) {
                            unswizzled = unswizzle(x, y, canvas.width, canvas.height);
                            outX = unswizzled.x;
                            outY = unswizzled.y;
                        }

                        if (channelOrder == SceGxmTextureSwizzle3Mode.RGB) {
                            imageData.data[(outX + canvas.width * outY) * 4 + 0] = reader.getUint8(pos+2);
                            imageData.data[(outX + canvas.width * outY) * 4 + 1] = reader.getUint8(pos+1);
                            imageData.data[(outX + canvas.width * outY) * 4 + 2] = reader.getUint8(pos+0);   
                        } else {
                            throw "Unsupported texture format 0x" + decimalToHex(subTexHeaders[i].format, 8);
                        }
                        imageData.data[(outX + canvas.width * outY) * 4 + 3] = 0xFF;
                        pos += 3;
                    }
                }
            } else if (baseFormat == SceGxmTextureBaseFormat.U8U8U8U8) {
                for (var y = 0; y < canvas.height; y++) {
                    for (var x = 0; x < canvas.width; x++) {
                        var outX = x;
                        var outY = y;
                        if (subTexHeaders[i].pixelOrder == SceGxmTextureType.Swizzled) {
                            unswizzled = unswizzle(x, y, canvas.width, canvas.height);
                            outX = unswizzled.x;
                            outY = unswizzled.y;
                        }

                        if (channelOrder == SceGxmTextureSwizzle4Mode.ARGB) {
                            imageData.data[(outX + canvas.width * outY) * 4 + 0] = reader.getUint8(pos+2);
                            imageData.data[(outX + canvas.width * outY) * 4 + 1] = reader.getUint8(pos+1);
                            imageData.data[(outX + canvas.width * outY) * 4 + 2] = reader.getUint8(pos+0);
                            imageData.data[(outX + canvas.width * outY) * 4 + 3] = reader.getUint8(pos+3);
                        } else {
                            throw "Unsupported texture format 0x" + decimalToHex(subTexHeaders[i].format, 8);
                        }
                        pos += 4;
                    }
                }
            } else if (baseFormat == SceGxmTextureBaseFormat.UBC1) {
                var blockCountX = Math.floor((canvas.width + 3) / 4);
                var blockCountY = Math.floor((canvas.height + 3) / 4);
                var blockWidth = (canvas.width < 4) ? canvas.width : 4;
                var blockHeight = (canvas.height < 4) ? canvas.height : 4;

                for (var k = 0; k < blockCountY; k++) {
                    for (var j = 0; j < blockCountX; j++) {
                        var x = j*4;
                        var y = k*4;

                        DecompressBlockDXT1(x, y, canvas.width, canvas.height, imageData, subTexHeaders[i].pixelOrder == SceGxmTextureType.Swizzled);
                    }
                }
            } else if (baseFormat == SceGxmTextureBaseFormat.P8) {
                for (var y = 0; y < canvas.height; y++) {
                    for (var x = 0; x < canvas.width; x++) {
                        var outX = x;
                        var outY = y;
                        if (subTexHeaders[i].pixelOrder == SceGxmTextureType.Swizzled) {
                            unswizzled = unswizzle(x, y, canvas.width, canvas.height);
                            outX = unswizzled.x;
                            outY = unswizzled.y;
                        }
                        var color = palettes[subTexHeaders[i].paletteIdx][reader.getUint8(pos)];
                        if (channelOrder == SceGxmTextureSwizzle4Mode._1RGB) {
                            // TODO verify on thing that actually has color
                            imageData.data[(outX + canvas.width * outY) * 4 + 0] = color[0];
                            imageData.data[(outX + canvas.width * outY) * 4 + 1] = color[1];
                            imageData.data[(outX + canvas.width * outY) * 4 + 2] = color[2];
                            imageData.data[(outX + canvas.width * outY) * 4 + 3] = 0xFF;
                        } else {
                            throw "Unsupported texture format 0x" + decimalToHex(subTexHeaders[i].format, 8);
                        }
                        pos += 1;
                    }
                }
            }
            else {
                throw "Unsupported texture format 0x" + decimalToHex(subTexHeaders[i].format, 8);
            }

            context.putImageData(imageData, 0, 0);

            var subTexture = new THREE.Texture();
            subTexture.image = canvas;
            subTexture.needsUpdate = true;
            subTextures.push(subTexture);
        }

        return subTextures;
    }

};