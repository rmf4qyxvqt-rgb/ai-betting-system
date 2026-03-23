# 🚀 DEPLOY AUTOMÁTICO - AI BETTING SYSTEM

## ✅ Status: Código no GitHub! 

Seu repo está aqui: 
👉 **https://github.com/rmf4qyxvqt-rgb/ai-betting-system**

---

## 🎯 2 PASSOS PARA COLOCAR NO AR

### **PASSO 1: Deploy Frontend (Vercel) - 1 CLIQUE**

Clique neste link e aguarde o deploy:

```
https://vercel.com/new/clone?repository-url=https://github.com/rmf4qyxvqt-rgb/ai-betting-system&rootDirectory=frontend&projectName=ai-betting-system&repo-name=ai-betting-system
```

**O que vai acontecer:**
1. Vercel vai detectar seu repo automaticamente
2. Vai detectar que é Next.js (frontend)
3. Vai fazer build e deploy
4. Vai dar uma URL tipo: `https://ai-betting-system-xxxx.vercel.app`

✅ **Copie essa URL e guarde!**

---

### **PASSO 2: Deploy Backend (Railway) - 1 CLIQUE**

Clique neste link:

```
https://railway.app?templateId=railroad
```

**OU depois acesse:**
https://railway.app/new

Selecione: **"Deploy from GitHub"** 
→ Escolha seu repo: `ai-betting-system`
→ Railway fará o resto automaticamente

---

## 🔗 CONECTAR OS DOIS

Depois que ambos estiverem deployados:

### **No Vercel:**
1. Vá para: **Settings → Environment Variables**
2. Adicione:
```
NEXT_PUBLIC_API_URL = https://seu-backend.railway.app
```
3. Clique "Redeploy"

### **No Railway:**
1. Vá para o seu projeto backend
2. Vá em: **Variables**
3. Adicione:
```
DATABASE_URL = sqlite:///./database/database.db
```

---

## ✨ PRONTO!

Seu site estará ONLINE em: 
🌐 **https://ai-betting-system-xxxx.vercel.app**

E o backend rodando em:
⚙️ **https://seu-backend.railway.app**

---

## 🚨 PROBLEMAS?

- **Frontend não carrega dados?** → Adicione NEXT_PUBLIC_API_URL no Vercel
- **Backend dá erro?** → Verifique se DATABASE_URL está no Railway
- **Precisa reiniciar?** → Clique "Redeploy" no Vercel/Railway

---

**Está tudo pronto! É só clicar nos links acima! 🎉**
