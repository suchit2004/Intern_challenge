function renderFormWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-form';
  card.innerHTML = `<h4>${widget.title}</h4>`;
  const form = document.createElement('form');
  widget.formFields.forEach(field => {
    form.innerHTML += `
      <div class="form-group">
        <label>${field.label}</label>
        <input type="text" name="${field.name}">
      </div>`;
  });
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.innerText = "Submit";
  form.appendChild(btn);
  card.appendChild(form);
  container.appendChild(card);
}