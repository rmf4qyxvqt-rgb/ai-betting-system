# Script de Deploy Automático - AI Betting System

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          DEPLOY AUTOMÁTICO - AI BETTING SYSTEM             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar tokens
$VERCEL_TOKEN = Read-Host "Cole seu token do Vercel (vercel.com/account/tokens)"
$RAILWAY_TOKEN = Read-Host "Cole seu token do Railway (railway.app/account)"
$GITHUB_USERNAME = "rmf4qyxvqt-rgb"
$REPO_NAME = "ai-betting-system"

Write-Host ""
Write-Host "🚀 Iniciando deploy..." -ForegroundColor Green
Write-Host ""

# ========== FRONTEND - VERCEL ==========
Write-Host "📦 [1/4] FRONTEND - Fazendo deploy no Vercel..." -ForegroundColor Yellow

$env:VERCEL_TOKEN = $VERCEL_TOKEN
Set-Location "frontend"

# Deploy do frontend
vercel --token=$VERCEL_TOKEN --yes --env=NEXT_PUBLIC_API_URL=https://railway-backend.railway.app --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend deployado com sucesso!" -ForegroundColor Green
    $FRONTEND_URL = "https://ai-betting-system.vercel.app"
} else {
    Write-Host "❌ Erro no deploy do frontend" -ForegroundColor Red
    exit 1
}

Set-Location ".."

# ========== BACKEND - RAILWAY ==========
Write-Host ""
Write-Host "⚙️  [2/4] BACKEND - Fazendo deploy no Railway..." -ForegroundColor Yellow

$env:RAILWAY_TOKEN = $RAILWAY_TOKEN
Set-Location "backend"

# Deploy do backend
railway up --token=$RAILWAY_TOKEN --environment=production

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend deployado com sucesso!" -ForegroundColor Green
    $BACKEND_URL = "https://railway-backend.railway.app"
} else {
    Write-Host "❌ Erro no deploy do backend" -ForegroundColor Red
    exit 1
}

Set-Location ".."

# ========== CONFIGURAÇÃO FINAL ==========
Write-Host ""
Write-Host "⚙️  [3/4] Configurando variáveis de ambiente..." -ForegroundColor Yellow

Write-Host "🔗 Conectando Frontend ao Backend..." -ForegroundColor Cyan

Set-Location "frontend"
vercel env add NEXT_PUBLIC_API_URL --token=$VERCEL_TOKEN --environment=production
Write-Output $BACKEND_URL | vercel env add NEXT_PUBLIC_API_URL --token=$VERCEL_TOKEN --environment=production

Set-Location ".."

# ========== RESUMO FINAL ==========
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ DEPLOY CONCLUÍDO COM SUCESSO!              ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 FRONTEND:"
Write-Host "   URL: https://ai-betting-system.vercel.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚙️  BACKEND:"
Write-Host "   URL: Verifique no seu painel Railway" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "   1. Acesse seu dashboard Frontend" -ForegroundColor White
Write-Host "   2. Verifique se está conectado ao backend" -ForegroundColor White
Write-Host "   3. Pronto! Sistema está no ar! 🎉" -ForegroundColor White
Write-Host ""
