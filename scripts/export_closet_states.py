"""Compõe as imagens das frestas do armário a partir das artes do jogo. Requer Pillow."""

from argparse import ArgumentParser
from itertools import combinations
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from export_office_states import CHARACTERS, OFFICE, load


CLOSET = OFFICE / "closet"
CLOSET_SOURCES = Path(__file__).resolve().parents[1] / "outros/arte/office/closet"
DOORWAY_SOURCES = {
    "original": "doorway-original.png",
    "gotica": "doorway-gotica.png",
    "yandere": "doorway-yandere.png",
    "platinada": "doorway-platinada.png",
}

# Contornos na arte das cinco Nathzinhas, separados pelas três frestas.
ROOM_OUTLINES = {
    "original": [
        [(437, 420), (438, 386), (449, 369), (468, 352), (486, 305), (472, 291),
         (472, 273), (492, 253), (515, 245), (541, 249), (562, 264), (573, 293),
         (568, 334), (561, 350), (573, 369), (581, 382), (585, 420)],
        [(447, 471), (588, 471), (599, 508), (613, 536), (620, 561), (618, 585),
         (608, 601), (595, 603), (595, 584), (603, 556), (585, 571), (576, 613),
         (564, 654), (490, 654), (476, 628), (463, 581), (449, 557), (442, 573),
         (454, 607), (438, 603), (427, 583), (427, 554), (438, 513)],
        [(474, 707), (517, 707), (512, 746), (513, 774), (520, 810), (519, 826),
         (476, 826), (472, 801), (475, 774), (472, 748)],
        [(527, 707), (568, 707), (564, 743), (568, 769), (562, 795), (573, 826),
         (535, 826), (528, 808), (531, 773), (526, 747)],
    ],
    "yandere": [
        [(623, 420), (621, 362), (635, 328), (630, 297), (640, 275), (656, 261),
         (680, 255), (691, 265), (702, 259), (717, 269), (741, 270), (759, 283),
         (773, 283), (772, 299), (778, 314), (773, 344), (765, 360), (777, 400),
         (774, 420)],
        [(666, 472), (744, 472), (766, 503), (771, 520), (763, 532), (775, 554),
         (782, 583), (772, 581), (754, 562), (739, 628), (745, 655), (661, 655),
         (668, 629), (646, 569), (623, 551), (626, 528), (649, 497)],
        [(662, 707), (696, 707), (692, 746), (699, 772), (705, 793), (701, 809),
         (673, 815), (665, 808), (661, 789), (665, 765)],
        [(710, 707), (744, 707), (739, 747), (742, 774), (746, 795), (739, 810),
         (713, 811), (705, 799), (707, 776), (709, 748)],
    ],
    "maid": [
        [(772, 420), (780, 395), (786, 376), (796, 362), (799, 328), (793, 330),
         (796, 294), (810, 280), (819, 269), (845, 261), (867, 266), (886, 277),
         (891, 293), (894, 319), (899, 353), (904, 376), (916, 396), (920, 420)],
        [(778, 472), (927, 472), (936, 506), (949, 530), (949, 548), (944, 562),
         (948, 580), (941, 587), (928, 571), (925, 547), (903, 564), (889, 602),
         (882, 622), (889, 651), (805, 651), (810, 620), (794, 567), (777, 561),
         (765, 581), (758, 579), (766, 545), (767, 524)],
        [(804, 707), (836, 707), (836, 745), (843, 778), (843, 792), (814, 796),
         (806, 789), (805, 765)],
        [(855, 707), (887, 707), (885, 749), (887, 777), (881, 791), (855, 794),
         (849, 786), (851, 763)],
    ],
    "gotica": [
        [(954, 420), (953, 397), (969, 371), (973, 347), (984, 310), (970, 308),
         (981, 291), (984, 269), (998, 252), (1008, 256), (1014, 237), (1030, 251),
         (1056, 250), (1076, 261), (1089, 282), (1093, 315), (1089, 346),
         (1089, 363), (1102, 380), (1105, 402), (1105, 420)],
        [(969, 472), (1114, 472), (1126, 497), (1137, 524), (1140, 552), (1150, 577),
         (1143, 597), (1136, 587), (1138, 565), (1120, 567), (1110, 613), (1090, 655),
         (1000, 655), (985, 621), (974, 595), (965, 565), (970, 584), (963, 603),
         (948, 594), (949, 564), (956, 534)],
        [(991, 707), (1034, 707), (1031, 751), (1033, 778), (1054, 808), (1052, 826),
         (1009, 826), (1000, 795), (998, 747), (991, 738)],
        [(1045, 707), (1099, 707), (1089, 743), (1087, 781), (1092, 802), (1109, 821),
         (1062, 825), (1056, 814), (1058, 783), (1055, 753)],
    ],
    "platinada": [
        [(1136, 419), (1133, 410), (1128, 406), (1120, 397), (1113, 392), (1109, 383),
         (1113, 376), (1120, 375), (1119, 368), (1126, 365), (1133, 368), (1136, 363),
         (1145, 364), (1153, 372), (1144, 348), (1136, 348), (1139, 323), (1133, 309),
         (1131, 288), (1134, 276), (1148, 276), (1166, 284), (1183, 277), (1201, 276),
         (1214, 266), (1230, 258), (1238, 258), (1244, 270), (1245, 285), (1250, 289),
         (1250, 299), (1256, 305), (1250, 311), (1261, 324), (1252, 322), (1260, 335),
         (1271, 341), (1281, 353), (1290, 355), (1291, 347), (1303, 333), (1320, 325),
         (1335, 325), (1349, 330), (1356, 338), (1359, 348), (1355, 354), (1348, 356),
         (1337, 351), (1324, 351), (1317, 359), (1317, 367), (1325, 386), (1339, 404),
         (1341, 419)],
        [(1141, 472), (1337, 472), (1339, 486), (1332, 497), (1352, 521), (1350, 539),
         (1337, 550), (1337, 565), (1322, 572), (1327, 587), (1319, 601), (1309, 602),
         (1307, 619), (1298, 625), (1290, 651), (1205, 651), (1197, 627), (1191, 605),
         (1175, 586), (1183, 575), (1158, 558), (1158, 541), (1165, 526), (1175, 514),
         (1161, 519), (1148, 519), (1139, 510), (1138, 497)],
        [(1197, 708), (1233, 708), (1232, 726), (1238, 732), (1230, 748),
         (1237, 757), (1230, 776), (1241, 789), (1246, 819), (1238, 825), (1197, 825),
         (1194, 812), (1196, 780), (1191, 769), (1188, 756), (1196, 749), (1190, 739)],
        [(1257, 708), (1295, 708), (1296, 730), (1302, 737), (1296, 750), (1305, 760),
         (1301, 772), (1290, 781), (1293, 806), (1286, 824), (1256, 825), (1247, 819),
         (1254, 794), (1262, 781), (1258, 767), (1262, 751), (1253, 738)],
    ],
}


def masked(image, outlines, feather=1):
    mask = Image.new("L", image.size)
    draw = ImageDraw.Draw(mask)
    for outline in outlines:
        draw.polygon(outline, fill=255)
    layer = image.copy()
    layer.putalpha(mask.filter(ImageFilter.GaussianBlur(feather)))
    return layer


def closed_gate(base):
    # Projeta a chapa do panorama (866,181)-(1310,547) no vão oblíquo das frestas.
    inverse = (-5.5689871062, 0, 5365.8406037429, -0.6525432333, -1.1766895665,
               866.7870655521, -0.0019628414, 0)
    shutter = load(OFFICE / "states/closed.webp").transform(
        base.size, Image.Transform.PERSPECTIVE, inverse, Image.Resampling.BICUBIC
    )
    shutter = masked(shutter, [[(1163, 289), (1353, 241), (1353, 517), (1338, 518),
                               (1339, 591), (1335, 596), (1335, 624), (1346, 626),
                               (1346, 754), (1163, 688)]])
    # A mesma queda de luz nas bordas das frestas mantém as ripas em primeiro plano.
    visibility = Image.new("L", (1, base.height))
    visibility.putdata([
        round(255 * max(0, min(1, (414 - y) / 10),
                        min(1, (y - 472) / 14, (653 - y) / 14),
                        min(1, (y - 710) / 12)))
        for y in range(base.height)
    ])
    shutter.putalpha(ImageChops.multiply(shutter.getchannel("A"), visibility.resize(base.size)))
    return Image.alpha_composite(base, shutter)


def room_art(base):
    master = load(CLOSET_SOURCES / "group.png").crop((0, 0, *base.size))
    room_layers = {character: masked(master, outlines) for character, outlines in ROOM_OUTLINES.items()}
    # A Platinada cruza o vão escuro. Abra espaço para o portão aparecer em volta dela.
    dark = base.getchannel("R").point(lambda value: 255 if value < 12 else 0)
    foreground = master.getchannel("R").point(lambda value: min(255, max(0, (value - 10) * 11)))
    platinada = room_layers["platinada"]
    platinada.putalpha(ImageChops.multiply(
        platinada.getchannel("A"), Image.composite(foreground, Image.new("L", base.size, 255), dark)
    ))
    return room_layers


def export_overflow(output):
    layers = room_art(load(CLOSET_SOURCES / "door-slats.png"))
    output.mkdir(parents=True, exist_ok=True)
    # Only these portraits can follow the first three in the canonical art order.
    for character in CHARACTERS[3:]:
        layers[character].save(output / f"{character}.webp", lossless=True, method=6)


def doorway_art(base):
    return {
        character: masked(load(CLOSET_SOURCES / name).crop((0, 0, *base.size)),
                          [[(541, 303), (698, 303), (698, 658), (541, 658)]], feather=3)
        for character, name in DOORWAY_SOURCES.items()
    }


def export(output):
    base = load(CLOSET_SOURCES / "door-slats.png")
    room_layers = room_art(base)
    doorway_layers = doorway_art(base)
    count = 0
    for gate, background in (("open", base), ("closed", closed_gate(base))):
        folder = output / gate
        folder.mkdir(parents=True, exist_ok=True)
        for size in range(4):
            for room in combinations(CHARACTERS, size):
                for doorway in (None, *DOORWAY_SOURCES):
                    if doorway in room:
                        continue
                    frame = background.copy()
                    if doorway:
                        frame.alpha_composite(doorway_layers[doorway])
                    for character in room:
                        frame.alpha_composite(room_layers[character])
                    room_key = "-".join(room) or "vazia"
                    filename = f"sala-{room_key}--porta-{doorway or 'vazia'}.webp"
                    frame.convert("RGB").save(folder / filename, quality=91, method=4)
                    count += 1
    return count


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Pasta para os quadros de referência exportados")
    parser.add_argument("--overflow-layers", action="store_true", help="Exporta apenas as camadas de ocupantes extras")
    args = parser.parse_args()
    if args.overflow_layers:
        export_overflow(args.output)
    else:
        print(f"{export(args.output)} imagens exportadas para {args.output}")
