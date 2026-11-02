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

## 같이 하기 (실시간)
`realtime/` 폴더는 별도 Worker(`doja-room`)예요. 같이 있는 사람의 위치·닉네임·말을 주고받아요.
1. Workers 및 Pages → 애플리케이션 생성 → Continue with GitHub → `doja` → 고급 설정의 **루트 디렉터리**에 `realtime` → 배포
2. Pages `doja` → 설정 → 바인딩 → 추가 → **Durable Object** → 변수 이름 `ROOM`, Worker `doja-room`, 클래스 `Room`
3. Pages 배포 다시 시도
