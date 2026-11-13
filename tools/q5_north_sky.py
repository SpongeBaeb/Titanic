import math, json
# 1912년 4월 14일 밤 하늘 (북쪽): 위도 41.73N, 지방항성시 LST
LAT = 41.73
LST = 10.8  # 시
STARS = [
  # name, RA(h), Dec(deg), mag, B-V, group
  ('Dubhe', 11.062, 61.75, 1.79, 1.07, 'UMa'), ('Merak', 11.031, 56.38, 2.37, -0.02, 'UMa'),
  ('Phecda', 11.897, 53.69, 2.44, 0.04, 'UMa'), ('Megrez', 12.257, 57.03, 3.31, 0.08, 'UMa'),
  ('Alioth', 12.900, 55.96, 1.77, -0.02, 'UMa'), ('Mizar', 13.399, 54.93, 2.27, 0.02, 'UMa'),
  ('Alcor', 13.420, 54.99, 4.01, 0.16, 'UMa'), ('Alkaid', 13.792, 49.31, 1.86, -0.10, 'UMa'),
  ('Polaris', 2.530, 89.26, 1.98, 0.60, 'UMi'), ('Yildun', 17.537, 86.59, 4.36, 0.02, 'UMi'),
  ('epsUMi', 16.766, 82.04, 4.21, 0.89, 'UMi'), ('zetUMi', 15.734, 77.79, 4.29, 0.04, 'UMi'),
  ('Kochab', 14.845, 74.16, 2.08, 1.47, 'UMi'), ('Pherkad', 15.345, 71.83, 3.05, 0.05, 'UMi'),
  ('etaUMi', 16.292, 75.76, 4.95, 0.37, 'UMi'),
  ('Caph', 0.153, 59.15, 2.27, 0.34, 'Cas'), ('Schedar', 0.675, 56.54, 2.24, 1.17, 'Cas'),
  ('gamCas', 0.945, 60.72, 2.47, -0.15, 'Cas'), ('Ruchbah', 1.430, 60.24, 2.68, 0.13, 'Cas'),
  ('Segin', 1.907, 63.67, 3.38, -0.15, 'Cas'),
  ('Alderamin', 21.310, 62.59, 2.45, 0.22, 'Cep'), ('Alfirk', 21.478, 70.56, 3.23, -0.22, 'Cep'),
  ('Errai', 23.655, 77.63, 3.21, 1.03, 'Cep'), ('iotCep', 22.828, 66.20, 3.52, 1.05, 'Cep'),
  ('zetCep', 22.181, 58.20, 3.35, 1.57, 'Cep'),
  ('Thuban', 14.073, 64.38, 3.65, -0.05, 'Dra'), ('Eltanin', 17.943, 51.49, 2.23, 1.52, 'Dra'),
  ('Rastaban', 17.507, 52.30, 2.79, 0.98, 'Dra'), ('etaDra', 16.400, 61.51, 2.73, 0.91, 'Dra'),
  ('zetDra', 17.146, 65.71, 3.17, -0.12, 'Dra'), ('delDra', 19.209, 67.66, 3.07, 1.00, 'Dra'),
  ('kapDra', 12.558, 69.79, 3.87, -0.13, 'Dra'), ('lamDra', 11.523, 69.33, 3.84, 1.62, 'Dra'),
  ('Capella', 5.278, 46.00, 0.08, 0.80, 'Aur'), ('Menkalinan', 5.992, 44.95, 1.90, 0.03, 'Aur'),
  ('Mirfak', 3.405, 49.86, 1.79, 0.48, 'Per'), ('Algol', 3.136, 40.96, 2.12, -0.05, 'Per'),
  ('Deneb', 20.690, 45.28, 1.25, 0.09, 'Cyg'), ('Vega', 18.616, 38.78, 0.03, 0.00, 'Lyr'),
  ('Arcturus', 14.261, 19.18, -0.05, 1.23, 'Boo'), ('Castor', 7.577, 31.89, 1.58, 0.03, 'Gem'),
  ('Pollux', 7.755, 28.03, 1.14, 1.00, 'Gem'), ('CorCaroli', 12.934, 38.32, 2.89, -0.12, 'CVn'),
]

def altaz(ra, dec):
    H = math.radians((LST - ra) * 15)
    d = math.radians(dec); f = math.radians(LAT)
    alt = math.asin(math.sin(d)*math.sin(f) + math.cos(d)*math.cos(f)*math.cos(H))
    az = math.atan2(-math.sin(H)*math.cos(d), math.cos(f)*math.sin(d) - math.sin(f)*math.cos(d)*math.cos(H))
    return math.degrees(alt), (math.degrees(az) + 360) % 360

ALT0 = 46.0
def proj(alt, az):
    # 북쪽(az 0) alt0 을 가운데로 하는 입체 투영. 오른쪽 = 동쪽
    a = math.radians(alt); z = math.radians(az); a0 = math.radians(ALT0)
    # 방향 벡터 (x 동, y 북, z 위)
    v = (math.cos(a)*math.sin(z), math.cos(a)*math.cos(z), math.sin(a))
    c = (0, math.cos(a0), math.sin(a0))
    e = (1, 0, 0)  # 화면 오른쪽 = 동
    u = (0, -math.sin(a0), math.cos(a0))  # 화면 위
    dot = sum(p*q for p, q in zip(v, c))
    k = 2 / (1 + dot)
    return k*sum(p*q for p, q in zip(v, e)), k*sum(p*q for p, q in zip(v, u))

HY = 463.6
X0 = 720
# 가운데 아래(북쪽 지평선)가 HY 에 오도록
_, vh = proj(0, 0)
SCALE = 268
def img(alt, az):
    x, y = proj(alt, az)
    return X0 + SCALE*x, HY - SCALE*(y - vh)

out = []
for n, ra, dec, m, bv, g in STARS:
    alt, az = altaz(ra, dec)
    x, y = img(alt, az)
    out.append((n, g, round(alt, 1), round(az, 1), round(x), round(y), m, bv))
for o in out:
    print(o)
# 은하수: 은하 적도 (북극 RA 12h51.4 Dec +27.13, 좌표)
gp = []
import numpy as np
ra_ngp, dec_ngp = math.radians(192.859), math.radians(27.128)
l_ncp = math.radians(122.932)
for l in range(0, 360, 5):
    lr = math.radians(l); b = 0
    sd = math.sin(dec_ngp)*math.sin(b) + math.cos(dec_ngp)*math.cos(b)*math.cos(l_ncp - lr)
    dec = math.asin(sd)
    y = math.cos(b)*math.sin(l_ncp - lr); x = math.cos(dec_ngp)*math.sin(b) - math.sin(dec_ngp)*math.cos(b)*math.cos(l_ncp - lr)
    ra = (ra_ngp + math.atan2(y, x)) % (2*math.pi)
    alt, az = altaz(math.degrees(ra)/15, math.degrees(dec))
    if alt > -2 and (az > 270 or az < 90):
        X, Y = img(alt, az)
        gp.append((l, round(alt, 1), round(az, 1), round(X), round(Y)))
for g in gp: print('GP', g)
json.dump({'stars': out, 'gp': gp}, open('q5_north_sky.json', 'w'))
