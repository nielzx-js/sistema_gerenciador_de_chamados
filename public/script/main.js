function mostrarsenha(btnShowPass){
    const inputPass = btnShowPass.previousElementSibling
    const mostrarSenha = inputPass.type === 'password'

    inputPass.type = mostrarSenha ? 'text' : 'password'
    btnShowPass.classList.toggle('bi-eye-fill', !mostrarSenha)
    btnShowPass.classList.toggle('bi-eye-slash-fill', mostrarSenha)
}