# AppBikeConfig

Next.js + Neon starter app for Matrix, Order, Setup, Bike SKU Definition, and Bike Builder.

## Database

Run `/sql/schema.sql` in Neon first. Then optionally run `/sql/seed.sql`.

## Local

1. Copy `.env.example` to `.env.local`
2. Put your Neon `DATABASE_URL` in `.env.local`
3. Run:

```bash
npm install
npm run dev
```

## Push to GitHub

```bash
git init
git branch -M main
git remote add origin https://github.com/NicolasDuhem/AppBikeConfig.git
git add .
git commit -m "Initial AppBikeConfig Next.js + Neon starter"
git push -u origin main
```

If remote already has files:

```bash
git pull origin main --allow-unrelated-histories
git add .
git commit -m "Merge local starter with remote repo"
git push -u origin main
```
