function mostrarsenha(btnShowPass){
    const inputPass = btnShowPass.previousElementSibling
    const mostrarSenha = inputPass.type === 'password'

    inputPass.type = mostrarSenha ? 'text' : 'password'
    btnShowPass.classList.toggle('bi-eye-fill', !mostrarSenha)
    btnShowPass.classList.toggle('bi-eye-slash-fill', mostrarSenha)
}
 const form=document.getElementById("cadastro")
    const senha1=document.getElementById('senha1')
    const senha2=document.getElementById('senha2')

    form.addEventListener("submit",(event)=>{
        if(senha1.value !== senha2.value){
            event.preventDefault();
            erro.textContent="As senhas não coincidem";
            return;
        } 
        if(senha1.value === senha2.value){
            if(senha1.value.length<5){
            event.preventDefault();
            erro2.textContent="Insira uma senha de ao menos 5 caracteres";
            return;
            }
        }
    })

