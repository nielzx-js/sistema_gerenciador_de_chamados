const express = require('express');
const path = require('path');
const pool = require('./database');
const app = express();
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const session = require('express-session');
const { createHash, randomBytes } = require('crypto');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


//middlewares   
function verificarLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.redirect('/');
    }

    next();
}

//transporter

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_SENHA
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000
});

let passwordResetTableReady;

function ensurePasswordResetTable() {
    if (!passwordResetTableReady) {
        passwordResetTableReady = pool.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                email TEXT PRIMARY KEY,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL
            );
        `).then(() => undefined).catch(error => {
            passwordResetTableReady = undefined;
            throw error;
        });
    }

    return passwordResetTableReady;
}

function getPublicBaseUrl() {
    if (process.env.APP_URL) {
        const appUrl = new URL(process.env.APP_URL);
        if (appUrl.protocol !== 'http:' && appUrl.protocol !== 'https:') {
            throw new Error('APP_URL precisa usar HTTP ou HTTPS.');
        }
        return appUrl.origin;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('Configure APP_URL para habilitar a recuperação de senha.');
    }

    return `http://localhost:${process.env.PORT || 3000}`;
}

//session
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized: false
}))


//login
app.get('/',(req,res)=>{
    res.render('index')
})

app.post('/login', async (req,res)=>{
    const {email,senha}=req.body;
    const query='SELECT * FROM usuarios WHERE email=$1'
    const result=await pool.query(query,[email])
    if(result.rows.length===0){
       return res.send(`
            <script>
            alert('Usuario ou senha incorreto')
            history.back()
            </script>
            `)
    }
    const usuario=result.rows[0]
    const senhaCorreta= await bcrypt.compare(senha,usuario.senha)
    if(!senhaCorreta){
        return res.send(`
            <script>
            alert('Usuario ou senha incorreto')
            history.back()
            </script>
            `)
    
    }
    req.session.usuario = {
    id: usuario.id,
    email: usuario.email
};
    res.redirect('/inicio')
})

//configurações
app.get('/configuracoes',async (req,res)=>{
   try {
        const resposta = await fetch('https://api.github.com/users/nielzx-js');
        const usuario = await resposta.json();

        res.render('config', { usuario });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar perfil do GitHub');
    }
})

//inicio
app.get('/inicio',verificarLogin,async (req,res)=>{
    const usuarioId = req.session.usuario.id;
    const result = await pool.query(`
        SELECT *
        FROM chamados
        WHERE usuario_id = $1
        ORDER BY criado_em DESC;
    `, [usuarioId]);
    const chamadosResolvidos = result.rows.filter(chamado => chamado.status === 'resolvido').length;

    res.render('dashboard', {
        chamados: result.rows,
        totalChamados: result.rows.length,
        chamadosResolvidos
    });
})


//cadastro


app.get('/register',(req,res)=>{
    res.render("register")
})

  
app.post('/register', async (req,res)=>{
 const {email,senha1,senha2} = req.body

     const query = 'SELECT * FROM usuarios WHERE email = $1';
    const result = await pool.query(query, [email]);

    if (result.rows.length > 0) {
     return res.send(`
        <script>
            alert('Usuário já cadastrado');
            history.back();
        </script>
    `);
}
   
  
    if(senha1 !== senha2){
        return res.status(400).send("as senhas não são iguais")
    }

    try {
       let senhaHash= await bcrypt.hash(senha1, 10);
        const codigoVerificacao = Math.floor(100000 + Math.random() * 900000);
        await transporter.sendMail({
            from:process.env.EMAIL,
            to:email,
            subject:"código de verificação",
            html:`
            <div style="
            background-color: #0b080b;
            padding: 35px 20px;
            font-family: Arial, sans-serif;
            color: #F4EDF3;
        ">
            <div style="
                max-width: 450px;
                margin: 0 auto;
                background-color: #160f15;
                border: 1px solid #51404F;
                border-radius: 12px;
                padding: 30px;
                text-align: center;
            ">
                <h1 style="
                    color: #A875A0;
                    font-size: 25px;
                    margin-bottom: 20px;
                ">
                    Verificação de conta
                </h1>

                <p style="
                    color: #B7A8B5;
                    font-size: 15px;
                    line-height: 1.6;
                ">
                    Utilize o código abaixo para confirmar seu e-mail.
                </p>

                <div style="
                    background-color: #211720;
                    border: 1px solid #51404F;
                    border-radius: 8px;
                    padding: 18px 10px;
                    margin: 25px 0;
                ">
                    <span style="
                        color: #A875A0;
                        font-size: 30px;
                        font-weight: bold;
                        letter-spacing: 8px;
                    ">
                        ${codigoVerificacao}
                    </span>
                </div>

                <p style="
                    color: #B7A8B5;
                    font-size: 13px;
                    line-height: 1.5;
                ">
                    Este código é válido por 10 minutos.
                    Não compartilhe com ninguém.
                </p>

                <div style="
                    border-top: 1px solid #51404F;
                    margin-top: 25px;
                    padding-top: 18px;
                ">
                    <p style="
                        color: #B7A8B5;
                        font-size: 12px;
                        margin: 0;
                    ">
                        Se você não solicitou este cadastro,
                        ignore esta mensagem.
                    </p>
                </div>
            </div>
        </div>
            `

        })
         req.session.cadastro = {
         email,
         senhaHash,
         codigoVerificacao
        };  
    } catch (error) {
        console.error('Erro ao preparar cadastro ou enviar e-mail de verificação:', error);
        return res.status(500).send("Não foi possível enviar o e-mail de verificação. Confira as configurações de e-mail do servidor e tente novamente.");
    }
   
   res.redirect('/verify')
})

//rota de verificação de duas etapas
app.get('/verify',(req,res)=>{
    res.render('verify')

})
app.post('/verify',async (req,res)=>{
    const {codigoDigitado} = req.body
    const cadastro=req.session.cadastro
    if(!cadastro){
        return res.status(400).send("Cadasto expirado")
    }

    console.log('Código salvo:', cadastro.codigoVerificacao);
    console.log('Código digitado:', codigoDigitado);
    console.log('Cadastro na sessão:', cadastro);
    if(String(cadastro.codigoVerificacao)===String(codigoDigitado)){
        try{
          const query = 'INSERT INTO usuarios (email, senha) VALUES ($1, $2) RETURNING id, email';
          const values = [cadastro.email, cadastro.senhaHash];  
          const result= await pool.query(query,values)
          delete req.session.cadastro
          return res.send(`
     <script>
        alert('Cadastro realizado com sucesso!');
        window.location.href = '/';
    </script>
        `);
        }catch(error){
          console.error('Erro ao salvar usuário no Neon:', error);
          return res.status(500).send("Erro ao finalizar cadastro no banco de dados.");
        }
    }
return res.status(400).send("Codigo incorreto")

})


//para ver se o servidor tá rodando
app.get('/status-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'Online', servidor_tempo: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao conectar ao banco' });
  }
});

//recuperação de senha
app.get('/resetpassword',(req,res)=>{
    res.render('resetpassword', { mode: 'request' });
})

app.post('/resetpassword', async (req,res)=>{
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const mensagemGenerica = 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).render('resetpassword', {
            mode: 'request',
            error: 'Informe um e-mail válido.'
        });
    }

    try {
        const baseUrl = getPublicBaseUrl();
        await ensurePasswordResetTable();

        const userResult = await pool.query(
            'SELECT email FROM usuarios WHERE email = $1',
            [email]
        );

        if (userResult.rowCount === 0) {
            return res.render('resetpassword', {
                mode: 'request',
                message: mensagemGenerica
            });
        }

        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        await pool.query(`
            INSERT INTO password_reset_tokens (email, token_hash, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '1 hour')
            ON CONFLICT (email)
            DO UPDATE SET token_hash = EXCLUDED.token_hash,
                          expires_at = EXCLUDED.expires_at;
        `, [userResult.rows[0].email, tokenHash]);

        const resetUrl = new URL(`/resetpassword/${token}`, `${baseUrl}/`).toString();
        try {
            await transporter.sendMail({
                from: process.env.EMAIL,
                to: userResult.rows[0].email,
                subject: 'Redefinição de senha - BLACKLOG',
                text: `Use este link para criar uma nova senha. Ele expira em 1 hora: ${resetUrl}`,
                html: `
                    <div style="background:#0b080b;color:#F4EDF3;padding:32px;font-family:Arial,sans-serif">
                        <div style="max-width:520px;margin:auto;background:#160f15;border:1px solid #51404F;border-radius:12px;padding:28px">
                            <h1 style="color:#A875A0">Redefinir senha</h1>
                            <p>Recebemos uma solicitação para redefinir a senha da sua conta BLACKLOG.</p>
                            <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#A875A0;color:#000;text-decoration:none;border-radius:6px">Criar nova senha</a></p>
                            <p style="color:#B7A8B5">O link expira em 1 hora. Se você não solicitou a troca, ignore este e-mail.</p>
                        </div>
                    </div>
                `
            });
        } catch (error) {
            await pool.query(
                'DELETE FROM password_reset_tokens WHERE email = $1 AND token_hash = $2',
                [userResult.rows[0].email, tokenHash]
            );
            throw error;
        }

        return res.render('resetpassword', {
            mode: 'request',
            message: mensagemGenerica
        });
    } catch (error) {
        console.error('Erro ao iniciar recuperação de senha:', error);
        return res.status(500).render('resetpassword', {
            mode: 'request',
            error: 'Não foi possível enviar o link agora. Verifique a configuração de e-mail e tente novamente.'
        });
    }
})

app.get('/resetpassword/:token', async (req,res)=>{
    const token = req.params.token;
    if (!/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).render('resetpassword', {
            mode: 'invalid',
            error: 'Este link de redefinição é inválido ou expirou.'
        });
    }

    try {
        await ensurePasswordResetTable();
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const result = await pool.query(`
            SELECT email
            FROM password_reset_tokens
            WHERE token_hash = $1
              AND expires_at > NOW();
        `, [tokenHash]);

        if (result.rowCount === 0) {
            return res.status(400).render('resetpassword', {
                mode: 'invalid',
                error: 'Este link de redefinição é inválido ou expirou.'
            });
        }

        return res.render('resetpassword', {
            mode: 'new-password',
            token
        });
    } catch (error) {
        console.error('Erro ao validar link de recuperação de senha:', error);
        return res.status(500).render('resetpassword', {
            mode: 'invalid',
            error: 'Não foi possível validar o link agora. Tente novamente mais tarde.'
        });
    }
})

app.post('/resetpassword/:token', async (req,res)=>{
    const token = req.params.token;
    const { senhaNova, confirmarSenha } = req.body;

    if (!/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).render('resetpassword', {
            mode: 'invalid',
            error: 'Este link de redefinição é inválido ou expirou.'
        });
    }

    if (typeof senhaNova !== 'string' || senhaNova.length < 8) {
        return res.status(400).render('resetpassword', {
            mode: 'new-password',
            token,
            error: 'A nova senha precisa ter pelo menos 8 caracteres.'
        });
    }

    if (senhaNova !== confirmarSenha) {
        return res.status(400).render('resetpassword', {
            mode: 'new-password',
            token,
            error: 'As senhas não coincidem.'
        });
    }

    let client;
    try {
        await ensurePasswordResetTable();
        client = await pool.connect();
        await client.query('BEGIN');

        const tokenHash = createHash('sha256').update(token).digest('hex');
        const tokenResult = await client.query(`
            SELECT email
            FROM password_reset_tokens
            WHERE token_hash = $1
              AND expires_at > NOW()
            FOR UPDATE;
        `, [tokenHash]);

        if (tokenResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).render('resetpassword', {
                mode: 'invalid',
                error: 'Este link de redefinição é inválido ou expirou.'
            });
        }

        const senhaHash = await bcrypt.hash(senhaNova, 10);
        const updateResult = await client.query(
            'UPDATE usuarios SET senha = $1 WHERE email = $2',
            [senhaHash, tokenResult.rows[0].email]
        );

        if (updateResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).render('resetpassword', {
                mode: 'invalid',
                error: 'Não foi possível localizar a conta para este link.'
            });
        }

        await client.query(
            'DELETE FROM password_reset_tokens WHERE email = $1',
            [tokenResult.rows[0].email]
        );
        await client.query('COMMIT');

        return res.render('resetpassword', {
            mode: 'complete',
            message: 'Sua senha foi alterada. Você já pode entrar com a nova senha.'
        });
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Erro ao desfazer transação de redefinição de senha:', rollbackError);
            }
        }
        console.error('Erro ao redefinir senha:', error);
        return res.status(500).render('resetpassword', {
            mode: 'new-password',
            token,
            error: 'Não foi possível redefinir a senha agora. Tente novamente mais tarde.'
        });
    } finally {
        if (client) client.release();
    }
})

app.get('/add',verificarLogin,async (req,res)=>{
    res.render('novoChamado')
})


//CRUD

app.post('/add',verificarLogin, async (req,res)=>{
    const { titulo, descricao, prioridade } = req.body;
    const usuarioId = req.session.usuario.id;
    const query=`
    INSERT INTO chamados (usuario_id,titulo,descricao,prioridade)
      VALUES ($1, $2, $3, $4);
    `

  const result = await pool.query(query, [
    usuarioId,
    titulo,
    descricao,
    prioridade
]);
    if (result.rowCount> 0) {
    return res.send(`
        <script>
            alert('Chamado criado com sucesso!');
            window.location.href = '/add';
        </script>
    `);
    } else {
    return res.send(`
        <script>
            alert('Não foi possível criar um chamado novo.  ');
            window.location.href = '/add';
        </script>
    `);
    }
})



app.post('/editar/:id',verificarLogin, async (req,res)=>{
const { titulo, descricao, prioridade} = req.body;
    const query=`
     UPDATE chamados
    SET titulo = $1,
        descricao = $2,
        prioridade = $3,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE id = $4
    AND usuario_id = $5;`

    const id=req.session.usuario.id
    const chamadoId = req.params.id;
    const result= await pool.query(query,[titulo,descricao,prioridade,chamadoId,id])
    if (result.rowCount > 0) {
    return res.send(`
        <script>
            alert('Chamado atualizado com sucesso!');
            window.location.href = '/chamados';
        </script>
    `);
    } else {
    return res.send(`
        <script>
            alert('Não foi possível atualizar o chamado!');
            window.location.href = '/chamados';
        </script>
    `);
    }
})

app.get('/chamados',verificarLogin, async (req,res)=>{
    const id = req.session.usuario.id
    const query=`
    SELECT *
    FROM chamados
    WHERE usuario_id = $1
    ORDER BY
    CASE
        WHEN status = 'aberto' THEN 1
        WHEN status = 'em_andamento' THEN 2
        WHEN status = 'resolvido' THEN 3
        ELSE 4
    END,
    criado_em DESC; `

    const result= await pool.query(query,[id])
res.render('chamados',{chamados:result.rows})
})

app.post('/chamados/:id/status',verificarLogin,async (req,res)=>{
    const { status } = req.body;
    const statusesPermitidos = ['em_andamento', 'resolvido'];

    if (!statusesPermitidos.includes(status)) {
        return res.status(400).send('Status inválido.');
    }

    const result = await pool.query(`
        UPDATE chamados
        SET status = $1,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $2
        AND usuario_id = $3;
    `, [status, req.params.id, req.session.usuario.id]);

    if (result.rowCount === 0) {
        return res.status(404).send('Chamado não encontrado.');
    }

    return res.redirect('/inicio');
})


app.post('/deletar/:id',async (req,res)=>{
    const id = req.params.id
    const query =`
        DELETE FROM chamados WHERE id = $1
    `
    const result= await pool.query(query,[id])
      if (result.rowCount > 0) {
    return res.send(`
        <script>
            alert('Chamado deletado com sucesso!');
            window.location.href = '/chamados';
        </script>
    `);
    } else {
    return res.send(`
        <script>
            alert('Não foi possível deletar o chamado!');
            window.location.href = '/chamados';
        </script>
    `);

    }
})




app.get('/sobre-mim', async (req, res) => {
    try {
        const resposta = await fetch('https://api.github.com/users/nielzx-js');
        const usuario = await resposta.json();

        res.render('sobre-mim', { usuario });
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao carregar o perfil do GitHub');
    }
});


//logout
app.get('/logout',(req,res,next)=>{
    req.session.destroy((err)=>{
        if(err){
            return next(err)
        }
        res.clearCookie('connect.sid')
        return res.redirect('/')
    })
})

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;