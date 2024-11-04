// todo
const app = document.querySelector<HTMLDivElement>("#app")!;

const button = document.createElement("button");
button.innerHTML = "CLICK";

button.addEventListener("click", ()=>{
    alert("you clicked the button!");
})

app.append(button);
