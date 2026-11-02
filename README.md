# 도자의 숲 (doja)

초SOYOHO 온라인 흙멍 공방. Cloudflare Pages + D1(데이터) + R2(사진).

## Cloudflare 연결 (처음 한 번)
1. **D1 데이터베이스**: Storage & Databases → D1 → Create → 이름 `doja-db`
2. **R2 사진 저장소**: R2 Object Storage → Create bucket → 이름 `doja-photos`
3. **Pages 프로젝트**: Workers & Pages → Create → Pages → Connect to Git → `doja` 저장소
   - Build command 비움 / Build output directory `public`
4. **바인딩**: 프로젝트 → Settings → Bindings — D1 `DB` → `doja-db`, R2 `BLOBS` → `doja-photos`
5. **비밀값**: Settings → Variables and Secrets — `ADMIN_PASSWORD`(관리자 비밀번호), `WEATHER_KEY`(선택, 공공데이터포털 기상청 단기예보 인증키)
6. Deployments → **Retry deployment**

## 관리자
주소 끝에 `#admin` 을 붙이면 비밀번호를 물어요.

## 데이터
처음 열릴 때 `lib/seed.json` 의 공지·자판기 작품·전시를 DB에 한 번 채워요. 옮겨 온 사진은 `public/blob/`.
