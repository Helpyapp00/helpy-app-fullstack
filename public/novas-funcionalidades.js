// 🚨 NOVO: Funcionalidades para Pedidos Urgentes, Times Locais e Projetos de Time
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    const userId = localStorage.getItem('userId');
    const userType = localStorage.getItem('userType');

    // Função para abrir modal de imagem flutuante (tornada global)
    window.abrirModalImagem = function abrirModalImagem(fotoUrl) {
        // Verificar se a URL é válida e não é um avatar
        if (!fotoUrl || 
            typeof fotoUrl !== 'string' ||
            fotoUrl.includes('avatar') || 
            fotoUrl.includes('default-user') ||
            fotoUrl.includes('perfil') ||
            fotoUrl === '' ||
            fotoUrl === 'undefined' ||
            fotoUrl.trim() === '') {
            console.warn('⚠️ Tentativa de abrir modal com URL inválida ou avatar:', fotoUrl);
            return;
        }
        
        // Verificar se estamos na página de perfil - se sim, não abrir modal
        if (window.location.pathname.includes('/perfil') || window.location.pathname.includes('perfil.html')) {
            console.warn('⚠️ Tentativa de abrir modal na página de perfil - ignorando');
            return;
        }
        
        console.log('🖼️ Abrindo modal de imagem:', fotoUrl);
        const modalImagem = document.getElementById('image-modal-pedido');
        const imagemModal = document.getElementById('modal-image-pedido');
        const btnFecharModal = document.getElementById('close-image-modal-pedido');
        
        console.log('🔍 Elementos do modal:', {
            modalImagem: !!modalImagem,
            imagemModal: !!imagemModal,
            btnFecharModal: !!btnFecharModal
        });
        
        if (modalImagem && imagemModal && fotoUrl) {
            imagemModal.src = fotoUrl;
            
            // Remover classe hidden
            modalImagem.classList.remove('hidden');
            
            // Forçar display e visibilidade via style inline também
            modalImagem.style.display = 'flex';
            modalImagem.style.opacity = '1';
            modalImagem.style.visibility = 'visible';
            modalImagem.style.zIndex = '10001';
            
            document.body.style.overflow = 'hidden';
            
            console.log('✅ Modal aberto');
            console.log('🔍 Estado do modal:', {
                hasHidden: modalImagem.classList.contains('hidden'),
                display: window.getComputedStyle(modalImagem).display,
                opacity: window.getComputedStyle(modalImagem).opacity,
                visibility: window.getComputedStyle(modalImagem).visibility,
                zIndex: window.getComputedStyle(modalImagem).zIndex
            });
        } else {
            console.error('❌ Elementos do modal não encontrados ou URL inválida');
        }
    };

    // Fechar modal ao clicar no X ou fora da imagem
    const modalImagem = document.getElementById('image-modal-pedido');
    const btnFecharModal = document.getElementById('close-image-modal-pedido');
    
    function fecharModalImagem() {
        const modal = document.getElementById('image-modal-pedido');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            document.body.style.overflow = '';
            console.log('✅ Modal de imagem fechado');
        }
    }
    
    window.fecharModalImagem = fecharModalImagem;
    
    if (btnFecharModal) {
        // Remover listeners anteriores se existirem
        const novoBtnFechar = btnFecharModal.cloneNode(true);
        btnFecharModal.parentNode.replaceChild(novoBtnFechar, btnFecharModal);
        
        novoBtnFechar.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log('❌ Botão X clicado - fechando modal');
            fecharModalImagem();
        }, true); // Capture phase para executar primeiro
        
        // Também adicionar onclick direto como fallback
        novoBtnFechar.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log('❌ Botão X (onclick) clicado - fechando modal');
            fecharModalImagem();
            return false;
        };
    }
    
    if (modalImagem) {
        // Remover listener anterior se existir e adicionar novo
        const novoModal = modalImagem.cloneNode(true);
        modalImagem.parentNode.replaceChild(novoModal, modalImagem);
        
        novoModal.addEventListener('click', (e) => {
            // Fechar se clicar no overlay ou no próprio modal (não na imagem)
            if (e.target === novoModal || 
                e.target.classList.contains('image-modal-overlay') ||
                e.target.id === 'image-modal-pedido' ||
                e.target.classList.contains('close-btn-modal')) {
                e.stopPropagation();
                e.preventDefault();
                console.log('🖼️ Clicou no overlay - fechando modal');
                fecharModalImagem();
            }
        });
        
        // Reconfigurar o botão de fechar após clonar
        const novoBtnFechar = document.getElementById('close-image-modal-pedido');
        if (novoBtnFechar) {
            novoBtnFechar.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation();
                console.log('❌ Botão X clicado (overlay) - fechando modal');
                fecharModalImagem();
            }, true);
        }
        
        // Garantir que o modal comece fechado quando a página carrega, especialmente na página de perfil
        setTimeout(() => {
            if (modalImagem && !modalImagem.classList.contains('hidden')) {
                const imagemModal = document.getElementById('modal-image-pedido');
                if (!imagemModal || !imagemModal.src || imagemModal.src === '' || 
                    imagemModal.src.includes('avatar') || 
                    window.location.pathname.includes('/perfil') ||
                    window.location.pathname.includes('perfil.html')) {
                    fecharModalImagem();
                }
            }
        }, 100);
    }

    // Usar delegação de eventos para garantir que funcione mesmo com elementos carregados dinamicamente
    // IMPORTANTE: Não capturar cliques em avatares de perfil ou nomes de clientes
    // Usar bubble phase (false) para que listeners específicos executem primeiro na fase de captura
    document.addEventListener('click', (e) => {
        // PRIMEIRA VERIFICAÇÃO: Se o clique foi em um avatar de perfil, nome de cliente ou qualquer elemento relacionado
        const avatarClickable = e.target.closest('.clickable-avatar, .avatar-pequeno-pedido, .nome-cliente-clickable');
        if (avatarClickable) {
            console.log('🚫 Clique em avatar/nome detectado - ignorando modal de foto');
            return; // Não fazer nada, deixa o listener do avatar/nome processar
        }
        
        // SEGUNDA VERIFICAÇÃO: Se o elemento clicado diretamente é um avatar ou nome
        if (e.target.classList.contains('clickable-avatar') || 
            e.target.classList.contains('avatar-pequeno-pedido') ||
            e.target.classList.contains('nome-cliente-clickable')) {
            console.log('🚫 Elemento é avatar/nome - ignorando modal de foto');
            return;
        }
        
        // TERCEIRA VERIFICAÇÃO: Verificar se o elemento clicado está dentro de um container de avatar/nome
        const parentAvatar = e.target.closest('.pedido-cliente-header');
        if (parentAvatar) {
            // Se está dentro do header do cliente, verificar se é um avatar ou nome
            const isAvatarOrName = e.target.closest('.clickable-avatar, .avatar-pequeno-pedido, .nome-cliente-clickable');
            if (isAvatarOrName) {
                console.log('🚫 Clique dentro do header do cliente (avatar/nome) - ignorando modal de foto');
                return;
            }
            // Se é uma imagem dentro do header, verificar se é avatar
            if (e.target.tagName === 'IMG' || e.target.closest('img')) {
                const img = e.target.tagName === 'IMG' ? e.target : e.target.closest('img');
                if (img && (img.classList.contains('clickable-avatar') || img.classList.contains('avatar-pequeno-pedido'))) {
                    console.log('🚫 Imagem dentro de header de cliente - ignorando modal de foto');
                    return;
                }
            }
        }
        
        // QUARTA VERIFICAÇÃO: Verificar se o clique foi em uma foto de serviço (apenas fotos de serviço, não avatares)
        const fotoClickable = e.target.closest('.foto-pedido-clickable');
        if (fotoClickable) {
            // Verificar se não é um avatar ou nome de cliente
            const isAvatar = fotoClickable.classList.contains('clickable-avatar') || 
                           fotoClickable.classList.contains('avatar-pequeno-pedido') ||
                           fotoClickable.classList.contains('nome-cliente-clickable') ||
                           fotoClickable.closest('.clickable-avatar') ||
                           fotoClickable.closest('.avatar-pequeno-pedido') ||
                           fotoClickable.closest('.nome-cliente-clickable') ||
                           fotoClickable.closest('.pedido-cliente-header');
            
            if (!isAvatar) {
                const fotoUrl = fotoClickable.dataset.fotoUrl || fotoClickable.src;
                // Validar URL antes de abrir modal
                if (fotoUrl && 
                    !fotoUrl.includes('avatar') && 
                    !fotoUrl.includes('default-user') &&
                    fotoUrl !== '' &&
                    fotoUrl !== 'undefined') {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🖼️ Clicou na foto (delegação):', fotoUrl);
                    if (typeof window.abrirModalImagem === 'function') {
                        window.abrirModalImagem(fotoUrl);
                    } else {
                        console.error('❌ Função abrirModalImagem não encontrada');
                    }
                } else {
                    console.warn('⚠️ URL de foto inválida ou é avatar:', fotoUrl);
                }
            } else {
                console.log('🚫 Foto clicável é avatar - ignorando modal');
            }
        }
    }, false); // Bubble phase - executa DEPOIS dos listeners na fase de captura

    // Utilitário para cachear fotos de pedidos (para usar no lembrete de avaliação)
    function cacheFotoPedidoGenerico(src, pid) {
        if (!src) return;
        localStorage.setItem('ultimaFotoPedido', src);
        localStorage.setItem('fotoUltimoServicoConcluido', src);
        sessionStorage.setItem('ultimaFotoPedido', src);
        if (pid) {
            const pidClean = String(pid).match(/[a-fA-F0-9]{24}/)?.[0];
            if (pidClean) {
                localStorage.setItem(`fotoPedido:${pidClean}`, src);
                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                sessionStorage.setItem(`fotoPedido:${pidClean}`, src);
            }
        }
    }

    // Captura imagens de pedidos carregadas em qualquer modal/lista
    // (roda após o DOM pronto; também escuta carregamentos futuros de <img>)
    Array.from(document.querySelectorAll('img[src*="pedidos-urgentes"]')).forEach(img => {
        cacheFotoPedidoGenerico(img.src);
    });
    document.addEventListener('load', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.src && t.src.includes('pedidos-urgentes')) {
            cacheFotoPedidoGenerico(t.src);
        }
    }, true);

    // ============================================
    // PEDIDOS URGENTES ("Preciso Agora!")
    // ============================================
    
    const modalPedidoUrgente = document.getElementById('modal-pedido-urgente');
    const formPedidoUrgente = document.getElementById('form-pedido-urgente');
    const btnProcurarClientes = document.getElementById('btn-procurar-clientes');
    const modalPrecisoAgora = document.getElementById('modal-preciso-agora');

    // Controles de tipo de atendimento (Urgente x Agendado)
    const radioTipoUrgente = document.getElementById('pedido-tipo-urgente');
    const radioTipoAgendado = document.getElementById('pedido-tipo-agendado');
    const grupoPrazoUrgente = document.getElementById('grupo-prazo-urgente');
    const grupoAgendamento = document.getElementById('grupo-agendamento');
    const inputDataAgendamento = document.getElementById('pedido-data'); // hidden
    const inputHoraAgendamento = document.getElementById('pedido-hora'); // hidden
    const inputDataDisplay = document.getElementById('pedido-data-display');
    const inputHoraDisplay = document.getElementById('pedido-hora-display');
    const popupCalendario = document.getElementById('popup-calendario-agendamento');
    const popupHorario = document.getElementById('popup-horario-agendamento');
    const calLabelMes = document.getElementById('cal-label-mes');
    const calDiasContainer = document.getElementById('cal-dias-container');
    const listaHorariosAgendamento = document.getElementById('lista-horarios-agendamento');
    const btnCalPrevMes = document.getElementById('cal-prev-mes');
    const btnCalNextMes = document.getElementById('cal-next-mes');

    let calDataAtual = new Date();
    let calDataSelecionada = null;
    let horarioSelecionado = null;

    function atualizarVisibilidadeTipoAtendimento() {
        const modoAgendado = !!(radioTipoAgendado && radioTipoAgendado.checked);
        if (grupoPrazoUrgente) {
            grupoPrazoUrgente.style.display = modoAgendado ? 'none' : 'block';
        }
        if (grupoAgendamento) {
            grupoAgendamento.style.display = modoAgendado ? 'block' : 'none';
        }
    }

    if (radioTipoUrgente && radioTipoAgendado) {
        radioTipoUrgente.addEventListener('change', atualizarVisibilidadeTipoAtendimento);
        radioTipoAgendado.addEventListener('change', atualizarVisibilidadeTipoAtendimento);
        atualizarVisibilidadeTipoAtendimento();
    }

    // ===== Calendário e horários customizados =====
    function formatarDataISO(date) {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

    function formatarDataBR(date) {
        return date.toLocaleDateString('pt-BR');
    }

    function renderizarCalendario() {
        if (!popupCalendario || !calDiasContainer || !calLabelMes) return;

        const ano = calDataAtual.getFullYear();
        const mes = calDataAtual.getMonth(); // 0-11

        calLabelMes.textContent = calDataAtual.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric'
        });

        calDiasContainer.innerHTML = '';

        const primeiroDiaMes = new Date(ano, mes, 1);
        const diaSemanaPrimeiro = primeiroDiaMes.getDay(); // 0=Dom

        const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

        const hoje = new Date();
        const hojeISO = formatarDataISO(hoje);
        const selecionadaISO = calDataSelecionada ? formatarDataISO(calDataSelecionada) : null;

        // Preenche espaços vazios antes do dia 1
        for (let i = 0; i < diaSemanaPrimeiro; i++) {
            const span = document.createElement('div');
            span.className = 'agendamento-dia outro-mes';
            calDiasContainer.appendChild(span);
        }

        for (let dia = 1; dia <= ultimoDiaMes; dia++) {
            const dataDia = new Date(ano, mes, dia);
            const dataISO = formatarDataISO(dataDia);

            const span = document.createElement('div');
            span.className = 'agendamento-dia';
            span.textContent = String(dia);

            if (dataISO === hojeISO) {
                span.classList.add('hoje');
            }
            if (selecionadaISO && dataISO === selecionadaISO) {
                span.classList.add('selecionado');
            }

            span.addEventListener('click', () => {
                calDataSelecionada = dataDia;
                if (inputDataAgendamento) {
                    inputDataAgendamento.value = dataISO;
                }
                if (inputDataDisplay) {
                    inputDataDisplay.value = formatarDataBR(dataDia);
                }
                popupCalendario?.classList.add('hidden');
                renderizarCalendario();
            });

            calDiasContainer.appendChild(span);
        }
    }

    function gerarHorarios() {
        if (!listaHorariosAgendamento) return;
        listaHorariosAgendamento.innerHTML = '';

        const horarios = [];
        for (let hora = 6; hora <= 22; hora++) {
            ['00', '30'].forEach(min => {
                horarios.push(`${String(hora).padStart(2, '0')}:${min}`);
            });
        }

        horarios.forEach(horario => {
            const div = document.createElement('div');
            div.className = 'agendamento-horario-item';
            div.textContent = horario;

            if (horarioSelecionado === horario) {
                div.classList.add('selecionado');
            }

            div.addEventListener('click', () => {
                horarioSelecionado = horario;
                if (inputHoraAgendamento) {
                    inputHoraAgendamento.value = horario;
                }
                if (inputHoraDisplay) {
                    inputHoraDisplay.value = horario;
                }

                document
                    .querySelectorAll('.agendamento-horario-item.selecionado')
                    .forEach(el => el.classList.remove('selecionado'));
                div.classList.add('selecionado');

                popupHorario?.classList.add('hidden');
            });

            listaHorariosAgendamento.appendChild(div);
        });
    }

    // Navegação do calendário
    if (btnCalPrevMes) {
        btnCalPrevMes.addEventListener('click', () => {
            calDataAtual.setMonth(calDataAtual.getMonth() - 1);
            renderizarCalendario();
        });
    }
    if (btnCalNextMes) {
        btnCalNextMes.addEventListener('click', () => {
            calDataAtual.setMonth(calDataAtual.getMonth() + 1);
            renderizarCalendario();
        });
    }

    // Abertura dos popups ao clicar nos campos visíveis
    if (inputDataDisplay && popupCalendario) {
        inputDataDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = inputDataDisplay.getBoundingClientRect();
            popupCalendario.style.left = rect.left + 'px';
            popupCalendario.style.top = (rect.bottom + window.scrollY) + 'px';
            popupCalendario.classList.remove('hidden');
            renderizarCalendario();
            popupHorario?.classList.add('hidden');
        });
    }

    if (inputHoraDisplay && popupHorario) {
        inputHoraDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = inputHoraDisplay.getBoundingClientRect();
            popupHorario.style.left = rect.left + 'px';
            popupHorario.style.top = (rect.bottom + window.scrollY) + 'px';
            popupHorario.classList.remove('hidden');
            gerarHorarios();
            popupCalendario?.classList.add('hidden');
        });
    }

    // Fechar popups ao clicar fora
    document.addEventListener('click', (e) => {
        if (popupCalendario && !popupCalendario.contains(e.target) && e.target !== inputDataDisplay) {
            popupCalendario.classList.add('hidden');
        }
        if (popupHorario && !popupHorario.contains(e.target) && e.target !== inputHoraDisplay) {
            popupHorario.classList.add('hidden');
        }
    });

    // Botão "Procurar Clientes" dentro do modal de profissionais próximos
    // Disponível para todos os usuários (profissionais também podem precisar de outros profissionais)
    if (btnProcurarClientes) {
        btnProcurarClientes.addEventListener('click', () => {
            // Fecha o modal de profissionais próximos
            if (modalPrecisoAgora) {
                modalPrecisoAgora.classList.add('hidden');
            }
            // Abre o modal de pedido urgente
            if (modalPedidoUrgente) {
                modalPedidoUrgente.classList.remove('hidden');
                if (typeof atualizarVisibilidadeTipoAtendimento === 'function') {
                    atualizarVisibilidadeTipoAtendimento();
                }
            }
        });
    }

    // Preview de fotos do pedido urgente (múltiplas imagens)
    const inputFotoPedido = document.getElementById('pedido-foto');
    const btnSelecionarFotoPedido = document.getElementById('btn-selecionar-foto-pedido');
    const btnAdicionarFotoPedido = document.getElementById('btn-adicionar-foto-pedido');
    const previewFotosContainer = document.getElementById('preview-fotos-pedido');
    const previewFotoPedido = document.getElementById('preview-foto-pedido'); // fallback legado
    const imgPreviewPedido = document.getElementById('img-preview-pedido');   // fallback legado
    const fotosSelecionadas = [];

    function atualizarVisibilidadeBotoesFoto() {
        const temFotos = fotosSelecionadas.length > 0;
        if (btnSelecionarFotoPedido) {
            btnSelecionarFotoPedido.style.display = temFotos ? 'none' : 'inline-flex';
        }
        if (btnAdicionarFotoPedido) {
            btnAdicionarFotoPedido.style.display = temFotos ? 'inline-flex' : 'none';
        }
    }

    function limparFotosPedido() {
        fotosSelecionadas.length = 0;
        if (previewFotosContainer) {
            previewFotosContainer.innerHTML = '';
        }
        if (previewFotoPedido) previewFotoPedido.style.display = 'none';
        if (imgPreviewPedido) imgPreviewPedido.src = '';
        atualizarVisibilidadeBotoesFoto();
    }

    function criarThumbnailFoto(file, index) {
        if (!previewFotosContainer) return;

        const item = document.createElement('div');
        item.className = 'pedido-foto-item';
        item.dataset.index = String(index);

        const img = document.createElement('img');
        img.alt = 'Foto do serviço';

        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.className = 'pedido-foto-remove';
        btnRemover.innerHTML = '&times;';

        item.appendChild(img);
        item.appendChild(btnRemover);
        previewFotosContainer.appendChild(item);

                const reader = new FileReader();
                reader.onload = (event) => {
            img.src = event.target.result;
                };
                reader.readAsDataURL(file);

        btnRemover.addEventListener('click', () => {
            const fileIndex = fotosSelecionadas.indexOf(file);
            if (fileIndex !== -1) {
                fotosSelecionadas.splice(fileIndex, 1);
            }
            item.remove();
            atualizarVisibilidadeBotoesFoto();
            if (inputFotoPedido && fotosSelecionadas.length === 0) {
                inputFotoPedido.value = '';
            }
        });
    }

    if (btnSelecionarFotoPedido && inputFotoPedido) {
        const abrirSeletor = () => inputFotoPedido.click();

        btnSelecionarFotoPedido.addEventListener('click', abrirSeletor);
        if (btnAdicionarFotoPedido) {
            btnAdicionarFotoPedido.addEventListener('click', abrirSeletor);
        }

        inputFotoPedido.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;

            files.forEach((file) => {
                // Evita duplicar a mesma referência de arquivo
                if (!fotosSelecionadas.includes(file)) {
                    fotosSelecionadas.push(file);
                    criarThumbnailFoto(file, fotosSelecionadas.length - 1);
                }
            });

            atualizarVisibilidadeBotoesFoto();
        });
    }

    const inputServicoPedido = document.getElementById('pedido-servico');

    // Cacheia nome do serviço durante digitação
    if (inputServicoPedido) {
        inputServicoPedido.addEventListener('input', () => {
            const val = inputServicoPedido.value || '';
            try {
                localStorage.setItem('ultimoServicoNome', val);
                localStorage.setItem('ultimaDescricaoPedido', val);
                localStorage.setItem('ultimaDemanda', val);
            } catch (e) {
                console.warn('Falha ao cachear serviço (input)', e);
            }
        });
    }

    if (formPedidoUrgente) {
        formPedidoUrgente.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const servico = inputServicoPedido ? inputServicoPedido.value : '';
            const descricao = document.getElementById('pedido-descricao').value;
            // cache nome do serviço para usar no lembrete/avaliação
            try {
                localStorage.setItem('ultimoServicoNome', servico || '');
                localStorage.setItem('ultimaDescricaoPedido', descricao || servico || '');
                localStorage.setItem('ultimaDemanda', servico || descricao || '');
            } catch (e) {
                console.warn('Não foi possível cachear o nome do serviço', e);
            }
            // Categoria foi removida da interface; usamos um valor padrão para manter compatibilidade com o backend
            const categoria = 'outros';
            const rua = document.getElementById('pedido-rua').value;
            const numero = document.getElementById('pedido-numero').value;
            const bairro = document.getElementById('pedido-bairro').value;
            const referencia = document.getElementById('pedido-referencia').value;
            const cidade = document.getElementById('pedido-cidade').value;
            const estado = document.getElementById('pedido-estado').value;
            const prazoHoras = document.getElementById('pedido-prazo')?.value || '1';
            // Prepara todas as fotos selecionadas para envio
            const fotosParaEnviar = fotosSelecionadas.length > 0 ? fotosSelecionadas : (inputFotoPedido?.files ? Array.from(inputFotoPedido.files) : []);

            const tipoAtendimento = (radioTipoAgendado && radioTipoAgendado.checked) ? 'agendado' : 'urgente';
            let dataAgendadaIso = '';
            if (tipoAtendimento === 'agendado') {
                const data = inputDataAgendamento?.value;
                const hora = inputHoraAgendamento?.value;

                if (!data || !hora) {
                    alert('Por favor, selecione a data e o horário em que você precisa do serviço.');
                    return;
                }

                const combinado = new Date(`${data}T${hora}:00`);
                if (isNaN(combinado.getTime())) {
                    alert('Data ou horário inválidos. Tente novamente.');
                    return;
                }

                dataAgendadaIso = combinado.toISOString();
            }

            try {
                // Usa FormData para enviar arquivo
                const formData = new FormData();
                formData.append('servico', servico);
                formData.append('categoria', categoria);
                formData.append('descricao', descricao);
                formData.append('prazoHoras', prazoHoras);
                formData.append('tipoAtendimento', tipoAtendimento);
                if (dataAgendadaIso) {
                    formData.append('dataAgendada', dataAgendadaIso);
                }
                const enderecoCompleto = `${rua}, ${numero} - ${bairro}`;
                formData.append('localizacao', JSON.stringify({
                    endereco: enderecoCompleto,
                    rua,
                    numero,
                    bairro,
                    pontoReferencia: referencia,
                    cidade,
                    estado
                }));
                // Adiciona todas as fotos ao FormData
                console.log(`📤 Enviando ${fotosParaEnviar.length} foto(s) para o servidor`);
                fotosParaEnviar.forEach((foto, index) => {
                    formData.append('fotos', foto);
                    console.log(`  Foto ${index + 1}: ${foto.name || 'sem nome'} (${foto.size || 0} bytes)`);
                });

                const response = await fetch('/api/pedidos-urgentes', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                        // Não definir Content-Type, o browser define automaticamente com boundary para FormData
                    },
                    body: formData
                });

                let data = null;
                try {
                    const responseText = await response.text();
                    console.log('Resposta do servidor (texto):', responseText);
                    try {
                        data = JSON.parse(responseText);
                    } catch (parseError) {
                        console.error('Erro ao fazer parse do JSON:', parseError);
                        console.error('Resposta recebida:', responseText);
                        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 200)}`);
                    }
                } catch (parseError) {
                    console.error('Erro ao interpretar resposta do pedido urgente:', parseError);
                    alert(`Erro ao processar resposta do servidor: ${parseError.message}`);
                    return;
                }
                
                const successFlag = data && data.success === true;

                if (successFlag) {
                    // Feedback visual com check animado
                    const toast = document.createElement('div');
                    toast.className = 'toast-sucesso';
                    toast.innerHTML = `<span class="check-animado">✔</span> Pedido criado! ${data.profissionaisNotificados || 0} profissionais foram notificados.`;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.classList.add('show'), 10);
                    setTimeout(() => toast.remove(), 2500);

                    formPedidoUrgente.reset();
                    if (typeof atualizarVisibilidadeTipoAtendimento === 'function') {
                        atualizarVisibilidadeTipoAtendimento();
                    }
                    limparFotosPedido();
                    modalPedidoUrgente?.classList.add('hidden');
                } else {
                    console.error('Erro ao criar pedido urgente:', {
                        status: response.status,
                        ok: response.ok,
                        data
                    });
                    const errorMsg = (data && data.message) 
                        ? data.message 
                        : (data && data.error) 
                            ? data.error 
                            : `Erro ao criar pedido urgente. (status ${response.status || 'desconhecido'})`;
                    alert(errorMsg);
                    return;
                }
            } catch (error) {
                console.error('Erro ao criar pedido urgente:', error);
                alert('Erro ao criar pedido urgente.');
            }
        });
    }

    // Carregar propostas de um pedido (tornada global para uso em header-notificacoes.js)
    window.carregarPropostas = async function carregarPropostas(pedidoId) {
        const modalPropostas = document.getElementById('modal-propostas');
        const listaPropostas = document.getElementById('lista-propostas');
        
        if (!modalPropostas || !listaPropostas) return;

        try {
            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/propostas`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                modalPropostas.classList.remove('hidden');
                
                const pedido = data.pedido;
                const propostas = data.propostas || [];
                
                // Verificar se o pedido foi concluído mas não foi avaliado
                let pedidoFoiAvaliado = false;
                if (pedido && pedido.status === 'concluido') {
                    try {
                        const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedidoId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (avaliacaoResponse.ok) {
                            const avaliacaoData = await avaliacaoResponse.json();
                            pedidoFoiAvaliado = avaliacaoData.avaliacoes && avaliacaoData.avaliacoes.some(av => 
                                av.clienteId && (av.clienteId._id || av.clienteId) === loggedInUserId
                            );
                        }
                    } catch (error) {
                        console.error('Erro ao verificar avaliação:', error);
                    }
                }

                if (propostas.length === 0) {
                    listaPropostas.innerHTML = '<p>Ainda não há propostas. Profissionais serão notificados!</p>';
                    return;
                }

                let headerHtml = '';
                if (pedido) {
                    headerHtml = `
                        <div class="pedido-propostas-header">
                            <div class="pedido-propostas-info">
                                <strong>${pedido.servico || ''}</strong>
                                ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                                ${pedido.status === 'concluido' && !pedidoFoiAvaliado ? 
                                    '<p style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px;"><i class="fas fa-exclamation-triangle"></i> Serviço concluído! Falta avaliar o profissional.</p>' : 
                                    ''
                                }
                            </div>
                            ${pedido.foto ? `
                                <div class="pedido-propostas-foto">
                                    <img src="${pedido.foto}" alt="Foto do serviço" class="pedido-foto-miniatura" id="pedido-foto-miniatura">
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                const propostasHtml = propostas.map(proposta => {
                    const prof = proposta.profissionalId;
                    const nivel = prof.gamificacao?.nivel || 1;
                    const mediaAvaliacao = prof.mediaAvaliacao || 0;
                    const profId = prof._id || prof.id || prof.userId;
                    const perfilUrl = profId ? `/perfil.html?id=${profId}` : '#';
                    
                    return `
                        <div class="proposta-card">
                            <div class="proposta-header">
                                <a class="proposta-avatar-link" href="${perfilUrl}">
                                <img src="${prof.avatarUrl || prof.foto || 'imagens/default-user.png'}" 
                                     alt="${prof.nome}" class="proposta-avatar">
                                </a>
                                <div class="proposta-info-profissional">
                                    <strong><a class="link-perfil-proposta" href="${perfilUrl}">${prof.nome}</a></strong>
                                    <div class="proposta-meta">
                                        <span>Nível ${nivel}</span>
                                        ${mediaAvaliacao > 0 ? `<span>⭐ ${mediaAvaliacao.toFixed(1)}</span>` : ''}
                                        <span>${prof.cidade || ''} - ${prof.estado || ''}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="proposta-detalhes">
                                <div class="proposta-valor">
                                    <strong>R$ ${parseFloat(proposta.valor).toFixed(2)}</strong>
                                </div>
                                <div class="proposta-tempo">
                                    <i class="fas fa-clock"></i> ${proposta.tempoChegada}
                                </div>
                                ${proposta.observacoes ? `<p class="proposta-observacoes">${proposta.observacoes}</p>` : ''}
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button class="btn-aceitar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}">
                                Aceitar Proposta
                            </button>
                                <button class="btn-recusar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}" style="background: #dc3545; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                                    Recusar
                            </button>
                            </div>
                        </div>
                    `;
                }).join('');

                listaPropostas.innerHTML = headerHtml + propostasHtml;

                // Clique na miniatura para ampliar a imagem do serviço
                const miniatura = document.getElementById('pedido-foto-miniatura');
                if (miniatura) {
                    miniatura.addEventListener('click', () => {
                        const overlay = document.createElement('div');
                        overlay.className = 'imagem-overlay';
                        overlay.innerHTML = `
                            <div class="imagem-overlay-content">
                                <img src="${pedido.foto}" alt="Foto do serviço ampliada">
                            </div>
                        `;
                        overlay.addEventListener('click', () => overlay.remove());
                        document.body.appendChild(overlay);
                    });
                }

                // Adicionar listeners para aceitar propostas
                document.querySelectorAll('.btn-aceitar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoId = btn.dataset.pedidoId;
                        
                        abrirConfirmacaoAcao({
                            titulo: 'Aceitar proposta',
                            texto: 'Ao aceitar esta proposta, o serviço será iniciado com este profissional.',
                            exigeMotivo: false,
                            onConfirm: async () => {
                        try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/aceitar-proposta`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ propostaId })
                            });

                            const data = await response.json();
                            
                            if (data.success) {
                                        // Feedback visual de sucesso
                                        const toast = document.createElement('div');
                                        toast.className = 'toast-sucesso';
                                        toast.innerHTML = '<span class="check-animado">✔</span> Proposta aceita! Agora é só aguardar o profissional.';
                                        document.body.appendChild(toast);
                                        setTimeout(() => toast.classList.add('show'), 10);
                                        setTimeout(() => toast.remove(), 2500);

                                modalPropostas.classList.add('hidden');
                            } else {
                                alert(data.message || 'Erro ao aceitar proposta.');
                            }
                        } catch (error) {
                            console.error('Erro ao aceitar proposta:', error);
                            alert('Erro ao aceitar proposta.');
                                }
                        }
                    });
                });
                });

                // Adicionar listeners para recusar propostas
                document.querySelectorAll('.btn-recusar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoId = btn.dataset.pedidoId;

                        if (!confirm('Tem certeza que deseja recusar esta proposta?')) return;

            try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/recusar-proposta`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                                body: JSON.stringify({ propostaId })
                });

                const data = await response.json();
                
                if (data.success) {
                                alert('Proposta recusada com sucesso.');
                                await carregarPropostas(pedidoId);
                } else {
                                alert(data.message || 'Erro ao recusar proposta.');
                }
            } catch (error) {
                            console.error('Erro ao recusar proposta:', error);
                            alert('Erro ao recusar proposta.');
            }
                    });
        });
            }
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            listaPropostas.innerHTML = '<p>Erro ao carregar propostas.</p>';
        }
    }

    // ============================================
    // TIMES LOCAIS (somente listagem na lateral)
    // A criação de times de projeto é feita pelo modal "Montar Time" (script.js)
    // ============================================

    // Carregar times locais
    async function carregarTimesLocais() {
        const timesContainer = document.getElementById('times-container');
        if (!timesContainer) return;

        try {
            const response = await fetch('/api/times-locais');
            const data = await response.json();
            
            if (data.success && data.times.length > 0) {
                timesContainer.innerHTML = data.times.slice(0, 5).map(time => `
                    <div class="time-card-lateral">
                        <strong>${time.nome}</strong>
                        <small>Nível ${time.nivelMedio} • ${time.categoria}</small>
                    </div>
                `).join('');
            } else {
                timesContainer.innerHTML = '<p style="font-size: 12px; color: var(--text-secondary);">Nenhum time disponível</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar times locais:', error);
        }
    }

    if (userType === 'trabalhador') {
        carregarTimesLocais();
    }

    // ============================================
    // PROJETOS DE TIME / MUTIRÃO
    // ============================================
    
    const btnCriarProjetoTime = document.getElementById('btn-criar-projeto-time');
    const modalProjetoTime = document.getElementById('modal-projeto-time');
    const formProjetoTime = document.getElementById('form-projeto-time');
    const profissionaisListaProjeto = document.getElementById('profissionais-lista-projeto');
    const btnAdicionarProfissionalProjeto = document.getElementById('btn-adicionar-profissional-projeto');

    if (btnAdicionarProfissionalProjeto) {
        btnAdicionarProfissionalProjeto.addEventListener('click', () => {
            const novoItem = document.createElement('div');
            novoItem.className = 'profissional-item-projeto';
            novoItem.innerHTML = `
                <input type="text" placeholder="Tipo (ex: pintor)" class="tipo-profissional-projeto" required>
                <input type="number" placeholder="Qtd" class="qtd-profissional-projeto" min="1" value="1" required>
                <input type="number" placeholder="R$ por pessoa" class="valor-profissional-projeto" min="0" step="0.01" required>
                <button type="button" class="btn-remover-profissional-projeto">&times;</button>
            `;
            profissionaisListaProjeto.appendChild(novoItem);
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remover-profissional-projeto')) {
            if (profissionaisListaProjeto.children.length > 1) {
                e.target.closest('.profissional-item-projeto').remove();
            } else {
                alert('Você precisa de pelo menos um profissional.');
            }
        }
    });

    // ============================================
    // PEDIDOS URGENTES PARA PROFISSIONAIS
    // ============================================
    
    const btnVerPedidosUrgentes = document.getElementById('btn-ver-pedidos-urgentes');
    const btnServicosAtivos = document.getElementById('btn-servicos-ativos');
    const modalPedidosUrgentesProfissional = document.getElementById('modal-pedidos-urgentes-profissional');
    const listaPedidosUrgentes = document.getElementById('lista-pedidos-urgentes');
    const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
    const listaServicosAtivos = document.getElementById('lista-servicos-ativos');
    const modalEnviarProposta = document.getElementById('modal-enviar-proposta');
    const formEnviarProposta = document.getElementById('form-enviar-proposta');

    async function carregarPedidosUrgentes(categoria = null) {
        if (!listaPedidosUrgentes) return;

        try {
            let url = '/api/pedidos-urgentes';
            if (categoria) {
                url += `?categoria=${encodeURIComponent(categoria)}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.pedidos.length === 0) {
                    listaPedidosUrgentes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhum pedido urgente disponível no momento.</p>';
                    return;
                }

                listaPedidosUrgentes.innerHTML = data.pedidos.map(pedido => {
                    const cliente = pedido.clienteId;
                    // Pega o ID do cliente (pode ser objeto populado ou string)
                    let clienteId = typeof cliente === 'object' && cliente !== null 
                        ? (cliente._id || cliente.id) 
                        : cliente;
                    // Converte para string se necessário
                    clienteId = clienteId ? String(clienteId) : '';
                    const tempoRestante = Math.max(0, Math.ceil((new Date(pedido.dataExpiracao) - new Date()) / 60000));
                    const tipoAtendimento = pedido.tipoAtendimento || 'urgente';

                    let infoAtendimentoHtml = '';
                    if (tipoAtendimento === 'agendado' && pedido.dataAgendada) {
                        const dataAgendada = new Date(pedido.dataAgendada);
                        if (!isNaN(dataAgendada.getTime())) {
                            const dataBR = dataAgendada.toLocaleDateString('pt-BR');
                            const horaBR = dataAgendada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            infoAtendimentoHtml = `
                                <div class="pedido-info-atendimento">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>Atendimento agendado para ${dataBR} às ${horaBR}</span>
                                </div>
                            `;
                        }
                    } else {
                        infoAtendimentoHtml = `
                            <div class="pedido-info-atendimento">
                                <i class="fas fa-bolt"></i>
                                <span>Atendimento urgente</span>
                            </div>
                        `;
                    }
                    
                    return `
                        <div class="pedido-urgente-card" style="overflow: visible !important; overflow-x: visible !important; overflow-y: visible !important; max-height: none !important; height: auto !important;">
                            <div class="pedido-cliente-header">
                                <img src="${cliente?.avatarUrl || cliente?.foto || 'imagens/default-user.png'}" 
                                     alt="${cliente?.nome || 'Cliente'}" 
                                     class="avatar-pequeno-pedido clickable-avatar"
                                     data-cliente-id="${clienteId}"
                                     style="cursor: pointer;">
                                <div style="flex: 1;">
                                    <div class="nome-cliente-clickable" 
                                         data-cliente-id="${clienteId}"
                                         style="font-weight: 600; color: var(--primary-color); cursor: pointer; transition: color 0.2s;">
                                        ${cliente?.nome || 'Cliente'}
                                    </div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${pedido.localizacao.cidade} - ${pedido.localizacao.estado}</div>
                                </div>
                                <span class="tempo-restante">
                                    ${tipoAtendimento === 'agendado' ? '<i class="fas fa-calendar-alt"></i> Agendado' : `⏱️ ${tempoRestante} min`}
                                </span>
                            </div>
                            
                            ${pedido.foto || (pedido.fotos && pedido.fotos.length > 0) ? `
                                <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                    ${pedido.fotos && pedido.fotos.length > 0 ? 
                                        pedido.fotos.map((foto, idx) => `
                                            <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                        `).join('') :
                                        `<img src="${pedido.foto}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${pedido.foto}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                                    }
                                </div>
                            ` : ''}
                            
                            <div class="pedido-header">
                                <div>
                                    <strong>${pedido.servico}</strong>
                                </div>
                            </div>
                            
                            ${infoAtendimentoHtml}
                            
                            ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            
                            <div class="pedido-localizacao">
                                <i class="fas fa-map-marker-alt"></i> 
                                ${pedido.localizacao.endereco}
                            </div>
                            
                            <button class="btn-enviar-proposta" data-pedido-id="${pedido._id}">
                                <i class="fas fa-paper-plane"></i> Enviar Proposta
                            </button>
                        </div>
                    `;
                }).join('');

                // Adicionar listeners para enviar propostas
                document.querySelectorAll('.btn-enviar-proposta').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const pedidoId = btn.dataset.pedidoId;
                        document.getElementById('proposta-pedido-id').value = pedidoId;
                        modalEnviarProposta?.classList.remove('hidden');
                        modalPedidosUrgentesProfissional?.classList.add('hidden');
                    });
                });

                // Adicionar listeners para nome e avatar clicáveis (abrir perfil)
                // IMPORTANTE: Usar capture phase para executar ANTES do listener de delegação
                document.querySelectorAll('.nome-cliente-clickable, .clickable-avatar, .avatar-pequeno-pedido').forEach(element => {
                    // Remover listeners anteriores clonando o elemento
                    const novoElement = element.cloneNode(true);
                    element.parentNode.replaceChild(novoElement, element);
                    
                    const novoListener = (e) => {
                        e.stopPropagation(); // Evita que o clique se propague
                        e.preventDefault(); // Previne comportamento padrão
                        e.stopImmediatePropagation(); // Impede que outros listeners sejam executados
                        
                        // Fechar modal de imagem se estiver aberto antes de navegar
                        if (typeof window.fecharModalImagem === 'function') {
                            window.fecharModalImagem();
                        }
                        
                        const clienteId = novoElement.dataset.clienteId;
                        if (clienteId) {
                            console.log('👤 Abrindo perfil do cliente:', clienteId);
                            // Navegar imediatamente, sem delay
                            window.location.href = `/perfil?id=${clienteId}`;
                        }
                    };
                    novoElement.addEventListener('click', novoListener, true); // Capture phase - executa ANTES
                });

                // Adicionar listeners para fotos clicáveis (abrir modal)
                document.querySelectorAll('.foto-pedido-clickable').forEach(img => {
                    img.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const fotoUrl = img.dataset.fotoUrl || img.src;
                        console.log('🖼️ Clicou na foto:', fotoUrl);
                        if (typeof window.abrirModalImagem === 'function') {
                            window.abrirModalImagem(fotoUrl);
                        } else {
                            console.error('❌ Função abrirModalImagem não encontrada');
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar pedidos urgentes:', error);
            listaPedidosUrgentes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar pedidos urgentes. Tente novamente.</p>';
        }
    }

    // Event listener para o botão de filtrar
    const btnFiltrarPedidos = document.getElementById('btn-filtrar-pedidos');
    const filtroCategoriaPedidos = document.getElementById('filtro-categoria-pedidos');
    
    if (btnFiltrarPedidos && filtroCategoriaPedidos) {
        btnFiltrarPedidos.addEventListener('click', async () => {
            const categoria = filtroCategoriaPedidos.value || null;
            await carregarPedidosUrgentes(categoria);
        });
    }

    // Adicionar botão na lateral se for profissional (apenas para "Procurar pedidos")
    function adicionarBotoesAcaoRapida() {
        const currentUserType = localStorage.getItem('userType');
        console.log('🔍 Verificando userType:', currentUserType);
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        console.log('🔍 Seção ações rápidas encontrada:', !!acoesRapidas);
        
        if (currentUserType === 'trabalhador') {
            if (acoesRapidas) {
                // Verificar se o botão já existe antes de criar
                let btnVerPedidos = document.getElementById('btn-ver-pedidos-urgentes');
                if (!btnVerPedidos) {
                    console.log('✅ Criando botão "Procurar pedidos"');
                    btnVerPedidos = document.createElement('button');
                    btnVerPedidos.id = 'btn-ver-pedidos-urgentes';
                    btnVerPedidos.className = 'btn-acao-lateral';
                    btnVerPedidos.innerHTML = '<i class="fas fa-bolt"></i> Procurar pedidos';
                    btnVerPedidos.style.marginTop = '10px';
                    acoesRapidas.appendChild(btnVerPedidos);
                    
                    btnVerPedidos.addEventListener('click', async () => {
                        await carregarPedidosUrgentes();
                        const modal = document.getElementById('modal-pedidos-urgentes-profissional');
                        if (modal) modal.classList.remove('hidden');
                    });
                    console.log('✅ Botão "Procurar pedidos" criado com sucesso');
                } else {
                    console.log('⚠️ Botão "Procurar pedidos" já existe');
                }
            } else {
                console.error('❌ Seção .filtro-acoes-rapidas não encontrada para trabalhador');
            }
        } else if (currentUserType === 'cliente') {
            if (acoesRapidas) {
                // Verificar se o botão já existe antes de criar
                let btnMeusPedidos = document.getElementById('btn-meus-pedidos-urgentes');
                if (!btnMeusPedidos) {
                    console.log('✅ Criando botão "Meus Pedidos Urgentes"');
                    btnMeusPedidos = document.createElement('button');
                    btnMeusPedidos.id = 'btn-meus-pedidos-urgentes';
                    btnMeusPedidos.className = 'btn-acao-lateral';
                    btnMeusPedidos.innerHTML = '<i class="fas fa-list"></i> Meus Pedidos Urgentes';
                    btnMeusPedidos.style.marginTop = '10px';
                    acoesRapidas.appendChild(btnMeusPedidos);
                    
                    btnMeusPedidos.addEventListener('click', async () => {
                        modoVisualizacaoMeusPedidos = 'abertos';
                        // Carregar pedidos abertos automaticamente ao abrir o modal
                        await carregarMeusPedidosUrgentes('abertos');
                        const modal = document.getElementById('modal-meus-pedidos-urgentes');
                        if (modal) modal.classList.remove('hidden');
                    });
                    console.log('✅ Botão "Meus Pedidos Urgentes" criado com sucesso');
                } else {
                    console.log('⚠️ Botão "Meus Pedidos Urgentes" já existe');
                }
            } else {
                console.error('❌ Seção .filtro-acoes-rapidas não encontrada para cliente');
            }
        } else {
            console.log('⚠️ userType não é trabalhador nem cliente:', currentUserType);
        }
    }
    
    // Executar após o DOM estar completamente carregado
    // Múltiplos delays para garantir que o DOM esteja pronto
    setTimeout(() => {
        adicionarBotoesAcaoRapida();
    }, 100);
    setTimeout(() => {
        adicionarBotoesAcaoRapida();
    }, 500);
    setTimeout(() => {
        adicionarBotoesAcaoRapida();
    }, 1000);
    // Clique no botão de serviços ativos dentro do modal de pedidos urgentes
    if (btnServicosAtivos) {
        btnServicosAtivos.addEventListener('click', async () => {
            await carregarServicosAtivos();
            modalServicosAtivos?.classList.remove('hidden');
        });
    }

    // Função para carregar serviços ativos (tornada global para uso em header-notificacoes.js)
    window.carregarServicosAtivos = async function carregarServicosAtivos(pedidoIdDestacado = null) {
        if (!listaServicosAtivos) return;

        try {
            const response = await fetch('/api/pedidos-urgentes/ativos', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success) {
                listaServicosAtivos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar serviços ativos.</p>';
                return;
            }

            const pedidos = data.pedidos || [];
            if (pedidos.length === 0) {
                listaServicosAtivos.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você ainda não tem serviços ativos de pedidos urgentes.</p>';
                // Abre o modal mesmo sem pedidos (para quando é chamado de notificações)
                if (modalServicosAtivos) {
                    modalServicosAtivos.classList.remove('hidden');
                    console.log('✅ Modal de serviços ativos aberto (sem pedidos)');
                }
                return;
            }

            // Guarda fotos e nomes em cache local para uso na avaliação
            pedidos.forEach(p => {
                if (p._id) {
                    const pidClean = String(p._id).match(/[a-fA-F0-9]{24}/)?.[0];
                    const fotoSrc = p.foto;
                    if (pidClean) {
                        if (fotoSrc) {
                            localStorage.setItem(`fotoPedido:${pidClean}`, fotoSrc);
                            localStorage.setItem('fotoUltimoServicoConcluido', fotoSrc);
                            localStorage.setItem('ultimaFotoPedido', fotoSrc);
                        }
                        localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                        if (p.servico) {
                            localStorage.setItem(`nomeServico:${pidClean}`, p.servico);
                            localStorage.setItem('ultimoServicoNome', p.servico);
                            localStorage.setItem('nomeServicoConcluido', p.servico);
                        }
                    }
                }
            });

            listaServicosAtivos.innerHTML = pedidos.map(pedido => {
                const cliente = pedido.clienteId;
                const endereco = pedido.localizacao || {};
                const enderecoLinha = endereco.endereco || '';
                const cidadeEstado = `${endereco.cidade || ''}${endereco.cidade && endereco.estado ? ' - ' : ''}${endereco.estado || ''}`;
                const enderecoMapa = encodeURIComponent(`${enderecoLinha} ${cidadeEstado}`);
                const destaqueClass = pedidoIdDestacado && pedido._id === pedidoIdDestacado ? 'servico-ativo-destacado' : '';
                const fotoServico = pedido.foto || '';
                // Nome do serviço para cache/localStorage
                const nomeServico = pedido.servico || '';
                const pidCleanCard = String(pedido._id || '').match(/[a-fA-F0-9]{24}/)?.[0] || '';
                if (pidCleanCard && nomeServico) {
                    try {
                        localStorage.setItem(`nomeServico:${pidCleanCard}`, nomeServico);
                        localStorage.setItem('ultimoServicoNome', nomeServico);
                        localStorage.setItem('nomeServicoConcluido', nomeServico);
                    } catch (e) {
                        console.warn('Falha ao cachear nomeServico do card ativo', e);
                    }
                }

                return `
                    <div class="pedido-urgente-card ${destaqueClass}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div>
                                <strong style="font-size:16px;">${pedido.servico}</strong>
                            </div>
                            <span class="badge-status badge-aceito">Ativo</span>
                        </div>
                        <p style="margin:4px 0; color: var(--text-secondary);">
                            <i class="fas fa-user"></i> ${cliente?.nome || 'Cliente'}
                        </p>
                        <p style="margin:4px 0;">
                            <i class="fas fa-map-marker-alt"></i> ${enderecoLinha} ${cidadeEstado ? `- ${cidadeEstado}` : ''}
                        </p>
                        ${fotoServico || (pedido.fotos && pedido.fotos.length > 0) ? `
                            <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                ${pedido.fotos && pedido.fotos.length > 0 ? 
                                    pedido.fotos.map((foto, idx) => `
                                        <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;" loading="lazy">
                                    `).join('') :
                                    `<img src="${fotoServico}" alt="Foto do serviço" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px;" loading="lazy">`
                                }
                            </div>
                        ` : ''}
                        ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                        <div style="margin-top:10px; display:flex; justify-content:space-between; gap: 10px; flex-wrap: wrap;">
                            <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" target="_blank" rel="noopener noreferrer" class="btn-mapa-link">
                                <i class="fas fa-map"></i> Ver no mapa
                            </a>
                            <div style="display:flex; gap:8px;">
                                <button class="btn-servico-concluido" data-pedido-id="${pedido._id}" data-servico="${pedido.servico || ''}" data-foto-servico="${fotoServico}" style="padding:6px 10px; border-radius:6px; border:none; background:#28a745; color:#fff; cursor:pointer; font-size:13px;">
                                    <i class="fas fa-check"></i> Marcar serviço feito
                                </button>
                                <button class="btn-servico-cancelar" data-pedido-id="${pedido._id}" style="padding:6px 10px; border-radius:6px; border:none; background:#dc3545; color:#fff; cursor:pointer; font-size:13px;">
                                    <i class="fas fa-times"></i> Cancelar serviço
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Guarda a primeira foto renderizada (fallback) após montar o DOM
            const primeiraFoto = listaServicosAtivos.querySelector('.pedido-foto-servico img');
            if (primeiraFoto?.src) {
                const src = primeiraFoto.src;
                localStorage.setItem('ultimaFotoPedido', src);
                localStorage.setItem('fotoUltimoServicoConcluido', src);
            }

            // Listeners: marcar serviço feito
            document.querySelectorAll('.btn-servico-concluido').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoId = btn.dataset.pedidoId;
                    const nomeServico = btn.dataset.servico || '';
                    let fotoServico = btn.dataset.fotoServico || '';
                    if (!fotoServico) {
                        const card = btn.closest('.pedido-urgente-card');
                        const imgEl = card?.querySelector('.pedido-foto-servico img');
                        if (imgEl?.src) fotoServico = imgEl.src;
                    }
                    if (nomeServico) {
                        try {
                            localStorage.setItem('nomeServicoConcluido', nomeServico);
                            localStorage.setItem('ultimoServicoNome', nomeServico);
                            localStorage.setItem('ultimaDescricaoPedido', nomeServico);
                            const pidClean = String(pedidoId || '').match(/[a-fA-F0-9]{24}/)?.[0] || '';
                            if (pidClean) localStorage.setItem(`nomeServico:${pidClean}`, nomeServico);
                        } catch (e) {
                            console.warn('Falha ao cachear nome do serviço concluído', e);
                        }
                    }
                    if (fotoServico) {
                        // guarda para usar no lembrete de avaliação
                        localStorage.setItem('fotoUltimoServicoConcluido', fotoServico);
                        const pidClean = String(pedidoId || '').match(/[a-fA-F0-9]{24}/)?.[0];
                        if (pidClean) {
                            localStorage.setItem(`fotoPedido:${pidClean}`, fotoServico);
                            localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                        localStorage.setItem('ultimaFotoPedido', fotoServico);
                        }
                    }
                    abrirConfirmacaoAcao({
                        titulo: 'Marcar serviço como concluído',
                        texto: 'Confirme apenas se o serviço foi realmente finalizado.',
                        exigeMotivo: false,
                        onConfirm: async () => {
                            try {
                                const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/concluir-servico`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                const data = await resp.json();
                                if (data.success) {
                                    // Guarda referências para a avaliação (foto e pedido)
                                    const pid = (pedidoId && typeof pedidoId === 'string') ? pedidoId.trim() : '';
                                    const pidClean = pid.match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                    if (pidClean) {
                                        localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                                    }
                                    const toast = document.createElement('div');
                                    toast.className = 'toast-sucesso';
                                    toast.innerHTML = '<span class="check-animado">✔</span> Serviço marcado como concluído. O cliente poderá avaliar você.';
                                    document.body.appendChild(toast);
                                    setTimeout(() => toast.classList.add('show'), 10);
                                    setTimeout(() => toast.remove(), 2500);
                                    await carregarServicosAtivos();
                                } else {
                                    alert(data.message || 'Erro ao marcar serviço como concluído.');
                                }
                            } catch (error) {
                                console.error('Erro ao concluir serviço:', error);
                                alert('Erro ao concluir serviço.');
                            }
                        }
                    });
                });
            });

            // Listeners: cancelar serviço
            document.querySelectorAll('.btn-servico-cancelar').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoId = btn.dataset.pedidoId;
                    abrirConfirmacaoAcao({
                        titulo: 'Cancelar serviço',
                        texto: 'Informe o motivo do cancelamento. Isso ajuda a manter a segurança na plataforma.',
                        exigeMotivo: true,
                        onConfirm: async (motivo) => {
                            try {
                                const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar-servico`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ motivo })
                                });
                                const data = await resp.json();
                                if (data.success) {
                                    const toast = document.createElement('div');
                                    toast.className = 'toast-sucesso';
                                    toast.innerHTML = '<span class="check-animado">✔</span> Serviço cancelado com sucesso. O outro usuário recebeu o motivo do cancelamento.';
                                    document.body.appendChild(toast);
                                    setTimeout(() => toast.classList.add('show'), 10);
                                    setTimeout(() => toast.remove(), 2500);
                                    await carregarServicosAtivos();
                                } else {
                                    alert(data.message || 'Erro ao cancelar serviço.');
                                }
                            } catch (error) {
                                console.error('Erro ao cancelar serviço:', error);
                                alert('Erro ao cancelar serviço.');
                            }
                        }
                    });
                });
            });
            
            // Abre o modal se ele existir (para quando é chamado de notificações)
            if (modalServicosAtivos) {
                modalServicosAtivos.classList.remove('hidden');
                console.log('✅ Modal de serviços ativos aberto');
            }
        } catch (error) {
            console.error('Erro ao carregar serviços ativos:', error);
            listaServicosAtivos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar serviços ativos. Tente novamente.</p>';
            // Tenta abrir o modal mesmo em caso de erro (pode ter dados parciais)
            if (modalServicosAtivos) {
                modalServicosAtivos.classList.remove('hidden');
            }
        }
    }

    // Torna a função acessível globalmente
    window.carregarPedidosUrgentes = carregarPedidosUrgentes;

    // ============================================
    // MEUS PEDIDOS URGENTES (para clientes)
    // ============================================
    const btnMeusPedidosUrgentes = document.getElementById('btn-meus-pedidos-urgentes');
    const modalMeusPedidosUrgentes = document.getElementById('modal-meus-pedidos-urgentes');
    const listaMeusPedidosUrgentes = document.getElementById('lista-meus-pedidos-urgentes');
    const btnPedidosConcluidos = document.getElementById('btn-pedidos-concluidos');
    const modalPedidosConcluidos = document.getElementById('modal-pedidos-concluidos');
    const listaPedidosConcluidos = document.getElementById('lista-pedidos-concluidos');
    
    let modoVisualizacaoMeusPedidos = 'abertos'; // 'abertos' ou 'concluidos'

    // Tornar função global para ser chamada após avaliação
    window.carregarMeusPedidosUrgentes = async function carregarMeusPedidosUrgentes(modo = 'abertos') {
        if (!listaMeusPedidosUrgentes) return;

        try {
            modoVisualizacaoMeusPedidos = modo;
            
            let pedidosParaMostrar = [];
            
            if (modo === 'abertos') {
                // Buscar TODOS os pedidos (sem filtro de status) para incluir concluídos não avaliados
                const response = await fetch('/api/pedidos-urgentes/meus', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                
                if (data.success) {
                    // Pegar todos os pedidos da resposta (pedidos inclui todos, independente de status)
                    const todosPedidos = data.pedidos || [];
                    
                    // Se não tiver em pedidos, usar pedidosAtivos e pedidosExpirados
                    if (todosPedidos.length === 0) {
                        todosPedidos.push(...(data.pedidosAtivos || []), ...(data.pedidosExpirados || []));
                    }
                    
                    console.log('📦 Total de pedidos retornados pela API:', todosPedidos.length);
                    console.log('📦 Pedidos por status:', {
                        abertos: todosPedidos.filter(p => p.status === 'aberto').length,
                        em_andamento: todosPedidos.filter(p => p.status === 'em_andamento').length,
                        concluidos: todosPedidos.filter(p => p.status === 'concluido').length,
                        cancelados: todosPedidos.filter(p => p.status === 'cancelado').length
                    });
                    
                    // Separar pedidos por status
                    const pedidosAbertosOuEmAndamento = todosPedidos.filter(p => 
                        p.status === 'aberto' || p.status === 'em_andamento'
                    );
                    
                    // Buscar pedidos concluídos que TIVERAM PROPOSTA ACEITA e verificar se foram avaliados
                    const pedidosConcluidos = todosPedidos.filter(p => {
                        // Deve estar concluído E ter pelo menos uma proposta aceita
                        const temPropostaAceita = p.propostas && Array.isArray(p.propostas) && p.propostas.some(prop => prop.status === 'aceita');
                        return p.status === 'concluido' && temPropostaAceita;
                    });
                    
                    console.log('🔍 Pedidos concluídos com proposta aceita encontrados:', pedidosConcluidos.length);
                    
                    // Verificar quais pedidos concluídos não foram avaliados
                    const pedidosConcluidosNaoAvaliados = await Promise.all(
                        pedidosConcluidos.map(async (pedido) => {
                            try {
                                const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedido._id}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                
                                if (avaliacaoResponse.ok) {
                                    const avaliacaoData = await avaliacaoResponse.json();
                                    console.log('🔍 Verificando avaliações para pedido:', pedido._id, 'userId:', userId);
                                    console.log('🔍 Dados recebidos:', JSON.stringify(avaliacaoData, null, 2));
                                    
                                    // Verificar se há avaliação deste cliente para este pedido
                                    const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && Array.isArray(avaliacaoData.avaliacoes) && avaliacaoData.avaliacoes.some(av => {
                                        // clienteId pode vir populado (objeto) ou como string/ObjectId
                                        const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                                        const clienteIdStr = clienteId ? String(clienteId) : null;
                                        const userIdStr = userId ? String(userId) : null;
                                        const match = clienteIdStr && userIdStr && clienteIdStr === userIdStr;
                                        if (match) {
                                            console.log('✅ Avaliação encontrada para este pedido:', pedido._id, 'clienteId:', clienteIdStr, 'userId:', userIdStr);
                                        }
                                        return match;
                                    });
                                    
                                    // Se não tem avaliação, incluir nos pedidos abertos
                                    if (!temAvaliacao) {
                                        pedido.faltaAvaliar = true;
                                        console.log('✅ Pedido concluído não avaliado encontrado:', pedido._id, pedido.servico);
                                        return pedido;
                                    }
                                    console.log('❌ Pedido já avaliado - removendo da lista:', pedido._id);
                                    return null;
                                } else if (avaliacaoResponse.status === 401 || avaliacaoResponse.status === 403) {
                                    // Token inválido ou sem permissão - não incluir o pedido (já foi avaliado ou erro de autenticação)
                                    console.warn('⚠️ Erro de autenticação ao verificar avaliação do pedido:', pedido._id, 'Status:', avaliacaoResponse.status);
                                    // Não incluir o pedido se houver erro de autenticação (provavelmente já foi avaliado)
                                    return null;
                                } else {
                                    // Outro erro - assumir que não foi avaliado (para segurança)
                                    pedido.faltaAvaliar = true;
                                    console.log('⚠️ Não foi possível verificar avaliação (status:', avaliacaoResponse.status, '), incluindo pedido:', pedido._id);
                                    return pedido;
                                }
                            } catch (error) {
                                console.error('❌ Erro ao verificar avaliação do pedido:', pedido._id, error);
                                // Em caso de erro de rede/conexão, não incluir o pedido (para evitar duplicatas)
                                // Se o servidor estiver offline, melhor não mostrar do que mostrar incorretamente
                                return null;
                            }
                        })
                    );
                    
                    const concluidosNaoAvaliadosFiltrados = pedidosConcluidosNaoAvaliados.filter(p => p !== null);
                    console.log('📋 Pedidos concluídos não avaliados:', concluidosNaoAvaliadosFiltrados.length);
                    
                    // Combinar pedidos abertos/em_andamento com concluídos não avaliados
                    pedidosParaMostrar = [
                        ...pedidosAbertosOuEmAndamento,
                        ...concluidosNaoAvaliadosFiltrados
                    ];
                    
                    console.log('📊 Total de pedidos para mostrar:', pedidosParaMostrar.length);
                }
            } else if (modo === 'concluidos') {
                // Buscar pedidos concluídos que foram avaliados
                const response = await fetch('/api/pedidos-urgentes/meus?status=concluido', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                
                if (data.success) {
                    const pedidosConcluidos = data.pedidosAtivos || data.pedidos || [];
                    
                    // Verificar quais pedidos foram avaliados
                    const pedidosComAvaliacao = await Promise.all(
                        pedidosConcluidos.map(async (pedido) => {
                            try {
                                const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedido._id}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                
                                if (avaliacaoResponse.ok) {
                                    const avaliacaoData = await avaliacaoResponse.json();
                                    // Verificar se há avaliação deste cliente para este pedido
                                    const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && avaliacaoData.avaliacoes.some(av => {
                                        const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                                        return clienteId && String(clienteId) === String(userId);
                                    });
                                    if (temAvaliacao) {
                                        pedido.avaliado = true;
                                        return pedido;
                                    }
                                    return null;
                                }
                                return null;
                            } catch (error) {
                                console.error('Erro ao verificar avaliação do pedido:', error);
                                return null;
                            }
                        })
                    );
                    
                    pedidosParaMostrar = pedidosComAvaliacao.filter(p => p !== null);
                }
            }

            if (pedidosParaMostrar.length === 0) {
                const mensagem = modo === 'abertos' 
                    ? 'Você ainda não criou nenhum pedido urgente aberto.'
                    : 'Você ainda não tem pedidos concluídos avaliados.';
                listaMeusPedidosUrgentes.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--text-secondary);">${mensagem}</p>`;
                return;
            }

                // Log para debug
                console.log('📋 Pedidos carregados:', pedidosParaMostrar.map(p => ({
                    id: p._id,
                    servico: p.servico,
                    status: p.status,
                    temFoto: !!p.foto,
                    temFotos: p.fotos && p.fotos.length > 0,
                    numFotos: p.fotos ? p.fotos.length : 0
                })));

                function renderPedidoCard(pedido, expirado = false) {
                    const tempoRestante = Math.max(0, Math.ceil((new Date(pedido.dataExpiracao) - new Date()) / 60000));
                    const numPropostas = pedido.propostas?.length || 0;
                    const statusBadge = {
                        'aberto': '<span class="badge-status badge-aberto">Aberto</span>',
                        'em_andamento': '<span class="badge-status badge-aceito">Em andamento</span>',
                        'concluido': '<span class="badge-status badge-concluido">Concluído</span>',
                        'cancelado': '<span class="badge-status badge-cancelado">Cancelado</span>'
                    }[pedido.status] || '';

                    // Verifica se tem múltiplas fotos ou apenas uma
                    const temFotos = pedido.fotos && Array.isArray(pedido.fotos) && pedido.fotos.length > 0;
                    const temFotoUnica = pedido.foto && !temFotos;
                    const fotosParaMostrar = temFotos ? pedido.fotos : (temFotoUnica ? [pedido.foto] : []);

                    return `
                        <div class="pedido-urgente-card" style="margin-bottom: 20px; overflow: visible !important; overflow-x: visible !important; overflow-y: visible !important; max-height: none !important; height: auto !important;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div>
                                    <strong style="font-size: 18px;">${pedido.servico}</strong>
                                    ${statusBadge}
                                </div>
                                ${pedido.status === 'aberto' && !expirado ? `<span class="tempo-restante">⏱️ ${tempoRestante} min</span>` : ''}
                            </div>
                            
                            ${fotosParaMostrar.length > 0 ? `
                                <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                    ${fotosParaMostrar.length > 1 ? 
                                        fotosParaMostrar.map((foto, idx) => `
                                            <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                        `).join('') :
                                        `<img src="${fotosParaMostrar[0]}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${fotosParaMostrar[0]}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                                    }
                                </div>
                            ` : ''}
                            
                            ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            
                            <div class="pedido-localizacao">
                                <i class="fas fa-map-marker-alt"></i> 
                                ${pedido.localizacao.endereco}, ${pedido.localizacao.cidade} - ${pedido.localizacao.estado}
                            </div>

                            ${(() => {
                                // Encontrar proposta aceita
                                const propostaAceita = pedido.propostas?.find(p => p.status === 'aceita');
                                const profissionalAceito = propostaAceita?.profissionalId;
                                const valorAceito = propostaAceita?.valor;
                                
                                if (propostaAceita && profissionalAceito) {
                                    // Se tem proposta aceita, mostrar a caixa clicável
                                    return `
                                        <div class="proposta-aceita-clickable" 
                                             data-profissional-id="${profissionalAceito._id || profissionalAceito.id}" 
                                             data-pedido-id="${pedido._id}"
                                             data-servico="${pedido.servico || ''}"
                                             style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
                                             onmouseover="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(40, 167, 69, 0.1) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.5)';"
                                             onmouseout="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.3)';">
                                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                                                <div style="flex: 1;">
                                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                                        <i class="fas fa-check-circle" style="color: #28a745; font-size: 16px;"></i>
                                                        <strong style="color: #28a745; font-size: 14px;">Proposta Aceita</strong>
                                                    </div>
                                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                        ${profissionalAceito.foto || profissionalAceito.avatarUrl ? `
                                                            <img src="${profissionalAceito.foto || profissionalAceito.avatarUrl}" 
                                                                 alt="${profissionalAceito.nome}" 
                                                                 style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(40, 167, 69, 0.3); pointer-events: none;">
                                                        ` : ''}
                                                        <div style="flex: 1; min-width: 150px; pointer-events: none;">
                                                            <div style="font-weight: 600; color: var(--text-primary); font-size: 15px;">
                                                                ${profissionalAceito.nome || 'Profissional'}
                                                            </div>
                                                            ${profissionalAceito.cidade && profissionalAceito.estado ? `
                                                                <div style="font-size: 12px; color: var(--text-secondary);">
                                                                    <i class="fas fa-map-marker-alt"></i> ${profissionalAceito.cidade} - ${profissionalAceito.estado}
                                                                </div>
                                                            ` : ''}
                                                        </div>
                                                        ${valorAceito ? `
                                                            <div style="text-align: right; pointer-events: none;">
                                                                <div style="font-size: 18px; font-weight: 700; color: #28a745;">
                                                                    R$ ${parseFloat(valorAceito).toFixed(2)}
                                                                </div>
                                                                <div style="font-size: 11px; color: var(--text-secondary);">
                                                                    Valor aceito
                                                                </div>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                    ${pedido.status === 'concluido' && pedido.faltaAvaliar ? 
                                                        `<p class="mensagem-falta-avaliar" 
                                                             data-profissional-id="${profissionalAceito._id || profissionalAceito.id}" 
                                                             data-pedido-id="${pedido._id}"
                                                             data-servico="${pedido.servico || ''}"
                                                             style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px; cursor: pointer; padding: 8px; background: rgba(220, 53, 69, 0.1); border-radius: 4px; transition: background 0.2s;"
                                                             onmouseover="this.style.background='rgba(220, 53, 69, 0.2)'"
                                                             onmouseout="this.style.background='rgba(220, 53, 69, 0.1)'">
                                                            <i class="fas fa-exclamation-triangle"></i> Serviço concluído! Clique aqui para avaliar o profissional.
                                                        </p>` : 
                                                        ''
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                } else {
                                    // Se não tem proposta aceita, mostrar a seção normal de propostas
                                    return `
                                        <div style="margin-top: 15px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                                <strong><i class="fas fa-hand-holding-usd"></i> Propostas Recebidas: ${numPropostas}</strong>
                                                ${numPropostas > 0 ? `
                                                    <button class="btn-ver-propostas" data-pedido-id="${pedido._id}" style="padding: 8px 15px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                                        <i class="fas fa-eye"></i> Ver Propostas
                                                    </button>
                                                ` : ''}
                                            </div>
                                            ${pedido.status === 'concluido' && pedido.faltaAvaliar ? 
                                                (() => {
                                                    const propostaAceita = pedido.propostas?.find(p => p.status === 'aceita');
                                                    const profissionalId = propostaAceita?.profissionalId?._id || propostaAceita?.profissionalId?.id;
                                                    return profissionalId ? 
                                                        `<p class="mensagem-falta-avaliar" 
                                                             data-profissional-id="${profissionalId}" 
                                                             data-pedido-id="${pedido._id}"
                                                             data-servico="${pedido.servico || ''}"
                                                             style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px; cursor: pointer; padding: 8px; background: rgba(220, 53, 69, 0.1); border-radius: 4px; transition: background 0.2s;"
                                                             onmouseover="this.style.background='rgba(220, 53, 69, 0.2)'"
                                                             onmouseout="this.style.background='rgba(220, 53, 69, 0.1)'">
                                                            <i class="fas fa-exclamation-triangle"></i> Serviço concluído! Clique aqui para avaliar o profissional.
                                                        </p>` :
                                                        '<p style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px;"><i class="fas fa-exclamation-triangle"></i> Serviço concluído! Falta avaliar o profissional.</p>';
                                                })() : 
                                                ''
                                            }
                                            ${numPropostas === 0 && pedido.status === 'aberto' ? 
                                                (!expirado ? '<p style="color: var(--text-secondary); font-size: 14px;">Aguardando propostas de profissionais...</p>' : '') : 
                                                ''
                                            }
                                        </div>
                                    `;
                                }
                            })()}
                            ${pedido.status === 'aberto' && !expirado ? `
                                <div style="margin-top: 10px; text-align: right;">
                                    <button class="btn-cancelar-pedido" data-pedido-id="${pedido._id}" style="padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                        <i class="fas fa-times"></i> Apagar Pedido
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                let html = '';
                
                if (modo === 'abertos') {
                    // Separar por status
                    const pedidosAbertos = pedidosParaMostrar.filter(p => p.status === 'aberto');
                    const pedidosEmAndamento = pedidosParaMostrar.filter(p => p.status === 'em_andamento');
                    const pedidosConcluidosNaoAvaliados = pedidosParaMostrar.filter(p => p.status === 'concluido' && p.faltaAvaliar);
                    
                    console.log('📊 Renderização:', {
                        abertos: pedidosAbertos.length,
                        emAndamento: pedidosEmAndamento.length,
                        concluidosNaoAvaliados: pedidosConcluidosNaoAvaliados.length
                    });
                    
                    if (pedidosAbertos.length > 0) {
                        html += '<h4 style="margin-bottom: 10px;">Pedidos Abertos</h4>';
                        html += pedidosAbertos.map(p => renderPedidoCard(p, false)).join('');
                    }
                    
                    if (pedidosEmAndamento.length > 0) {
                        html += '<h4 style="margin: 20px 0 10px;">Pedidos em Andamento</h4>';
                        html += pedidosEmAndamento.map(p => renderPedidoCard(p, false)).join('');
                    }
                    
                    if (pedidosConcluidosNaoAvaliados.length > 0) {
                        html += '<h4 style="margin: 20px 0 10px;">Aguardando Avaliação</h4>';
                        html += pedidosConcluidosNaoAvaliados.map(p => renderPedidoCard(p, false)).join('');
                    }
                } else {
                    // Modo concluídos
                    html += '<h4 style="margin-bottom: 10px;">Pedidos Concluídos e Avaliados</h4>';
                    html += pedidosParaMostrar.map(p => renderPedidoCard(p, false)).join('');
                }

                listaMeusPedidosUrgentes.innerHTML = html;

                // Adicionar listeners para ver propostas
                document.querySelectorAll('.btn-ver-propostas').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const pedidoId = btn.dataset.pedidoId;
                        modalMeusPedidosUrgentes?.classList.add('hidden');
                        await carregarPropostas(pedidoId);
                    });
                });

                // Função auxiliar para redirecionar para avaliação
                const redirecionarParaAvaliacao = (profissionalId, pedidoId, servico) => {
                    // Salva informações no localStorage para usar na avaliação
                    if (pedidoId) {
                        const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0];
                        if (pidClean) {
                            localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                        }
                    }
                    if (servico) {
                        localStorage.setItem('ultimoServicoNome', servico);
                        localStorage.setItem('nomeServicoConcluido', servico);
                        if (pedidoId) {
                            const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0];
                            if (pidClean) {
                                localStorage.setItem(`nomeServico:${pidClean}`, servico);
                            }
                        }
                    }
                    
                    // Redireciona para a página de perfil com os parâmetros necessários
                    const params = new URLSearchParams({
                        id: profissionalId,
                        pedidoId: pedidoId,
                        servico: servico
                    });
                    window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                };
                
                // Adicionar listeners para avaliar pedidos concluídos não avaliados (card clicável)
                document.querySelectorAll('.proposta-aceita-clickable').forEach(card => {
                    card.addEventListener('click', async () => {
                        const profissionalId = card.dataset.profissionalId;
                        const pedidoId = card.dataset.pedidoId;
                        const servico = card.dataset.servico || '';
                        
                        // Verifica se o pedido está concluído e falta avaliar
                        const pedido = pedidosParaMostrar.find(p => p._id === pedidoId);
                        if (pedido && pedido.status === 'concluido' && pedido.faltaAvaliar) {
                            redirecionarParaAvaliacao(profissionalId, pedidoId, servico);
                        }
                    });
                });
                
                // Adicionar listeners para mensagem "falta avaliar" (quando não está dentro do card clicável)
                document.querySelectorAll('.mensagem-falta-avaliar').forEach(msg => {
                    msg.addEventListener('click', () => {
                        const profissionalId = msg.dataset.profissionalId;
                        const pedidoId = msg.dataset.pedidoId;
                        const servico = msg.dataset.servico || '';
                        redirecionarParaAvaliacao(profissionalId, pedidoId, servico);
                    });
                });
                
                // Adicionar listeners para cancelar pedidos
                document.querySelectorAll('.btn-cancelar-pedido').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const pedidoId = btn.dataset.pedidoId;
                        
                        // Usar modal de confirmação estilizado
                        abrirConfirmacaoAcao({
                            titulo: 'Cancelar pedido',
                            texto: 'Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.',
                            exigeMotivo: false,
                            onConfirm: async () => {
                                try {
                                    const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        }
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                        // Mostrar mensagem discreta em vermelho claro
                                        const mensagemDiscreta = document.createElement('div');
                                        mensagemDiscreta.style.cssText = 'position: fixed; top: 100px; right: 20px; background: rgba(239, 83, 80, 0.95); color: white; padding: 8px 16px; border-radius: 4px; font-size: 14px; z-index: 10000; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-weight: 500;';
                                        mensagemDiscreta.textContent = 'Cancelado';
                                        document.body.appendChild(mensagemDiscreta);
                                        
                                        setTimeout(() => {
                                            mensagemDiscreta.style.opacity = '0';
                                            mensagemDiscreta.style.transition = 'opacity 0.3s ease';
                                            setTimeout(() => mensagemDiscreta.remove(), 300);
                                        }, 1500);
                                        
                                        await carregarMeusPedidosUrgentes(modoVisualizacaoMeusPedidos);
                                    } else {
                                        alert(data.message || 'Erro ao cancelar pedido.');
                                    }
                                } catch (error) {
                                    console.error('Erro ao cancelar pedido urgente:', error);
                                    alert('Erro ao cancelar pedido.');
                                }
                            }
                        });
                    });
                });

                // Adicionar listeners para fotos clicáveis (abrir modal)
                document.querySelectorAll('.foto-pedido-clickable').forEach(img => {
                    img.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const fotoUrl = img.dataset.fotoUrl || img.src;
                        if (typeof window.abrirModalImagem === 'function') {
                            window.abrirModalImagem(fotoUrl);
                        }
                    });
                });

                // Adicionar listener para caixa de proposta aceita (navegar para avaliação)
                document.querySelectorAll('.proposta-aceita-clickable').forEach(caixa => {
                    caixa.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const profissionalId = caixa.dataset.profissionalId;
                        const pedidoId = caixa.dataset.pedidoId;
                        const servico = caixa.dataset.servico || '';
                        
                        if (!profissionalId || !pedidoId) {
                            console.error('❌ Dados insuficientes para navegar para avaliação');
                            return;
                        }

                        // Buscar informações do pedido para obter agendamentoId se existir
                        try {
                            const token = localStorage.getItem('token');
                            const pedidoResponse = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            let agendamentoId = null;
                            if (pedidoResponse.ok) {
                                const pedidoData = await pedidoResponse.json();
                                // Tentar encontrar agendamentoId na proposta aceita
                                const propostaAceita = pedidoData.pedido?.propostas?.find(p => p.status === 'aceita');
                                agendamentoId = propostaAceita?.agendamentoId || pedidoData.pedido?.agendamentoId || null;
                            }

                            // Preparar parâmetros para navegação
                            const params = new URLSearchParams({
                                id: profissionalId,
                                origem: 'pedido_urgente',
                                pedidoId: pedidoId
                            });

                            if (agendamentoId) {
                                params.set('agendamentoId', agendamentoId);
                            }

                            if (servico) {
                                params.set('servico', servico);
                            }

                            // Buscar foto do pedido do localStorage se disponível
                            const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                            if (pidClean) {
                                const fotoCache = localStorage.getItem(`fotoPedido:${pidClean}`) 
                                    || localStorage.getItem('fotoUltimoServicoConcluido')
                                    || localStorage.getItem('ultimaFotoPedido');
                                if (fotoCache) {
                                    params.set('foto', fotoCache);
                                }
                            }

                            // Navegar para o perfil com a seção de avaliação
                            console.log('🔗 Navegando para avaliação:', `/perfil?${params.toString()}#secao-avaliacao`);
                            console.log('🔗 Parâmetros sendo passados:', {
                                id: profissionalId,
                                origem: 'pedido_urgente',
                                pedidoId: pedidoId,
                                agendamentoId: agendamentoId || 'não fornecido',
                                servico: servico || 'não fornecido'
                            });
                            window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                        } catch (error) {
                            console.error('❌ Erro ao buscar dados do pedido:', error);
                            // Mesmo assim, tentar navegar sem agendamentoId
                            const params = new URLSearchParams({
                                id: profissionalId,
                                origem: 'pedido_urgente',
                                pedidoId: pedidoId
                            });
                            if (servico) {
                                params.set('servico', servico);
                            }
                            window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                        }
                    });
                });
        } catch (error) {
            console.error('Erro ao carregar meus pedidos urgentes:', error);
            listaMeusPedidosUrgentes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar seus pedidos. Tente novamente.</p>';
        }
    }


    // A função adicionarBotoesAcaoRapida já foi definida acima e cuida tanto de trabalhador quanto cliente

    // Listener para o botão "Concluídos"
    // Função para carregar pedidos concluídos em modal separado
    async function carregarPedidosConcluidos() {
        if (!listaPedidosConcluidos) return;

        try {
            listaPedidosConcluidos.innerHTML = '<p>Carregando pedidos concluídos...</p>';
            
            // Buscar pedidos concluídos que foram avaliados
            const response = await fetch('/api/pedidos-urgentes/meus?status=concluido', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                const pedidosConcluidos = data.pedidosAtivos || data.pedidos || [];
                
                // Verificar quais pedidos foram avaliados
                const pedidosComAvaliacao = await Promise.all(
                    pedidosConcluidos.map(async (pedido) => {
                        try {
                            const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedido._id}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            if (avaliacaoResponse.ok) {
                                const avaliacaoData = await avaliacaoResponse.json();
                                // Verificar se há avaliação deste cliente para este pedido
                                const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && avaliacaoData.avaliacoes.some(av => {
                                    const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                                    return clienteId && String(clienteId) === String(userId);
                                });
                                if (temAvaliacao) {
                                    pedido.avaliado = true;
                                    return pedido;
                                }
                                return null;
                            }
                            return null;
                        } catch (error) {
                            console.error('Erro ao verificar avaliação do pedido:', error);
                            return null;
                        }
                    })
                );
                
                const pedidosParaMostrar = pedidosComAvaliacao.filter(p => p !== null);

                if (pedidosParaMostrar.length === 0) {
                    listaPedidosConcluidos.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você ainda não tem pedidos concluídos avaliados.</p>';
                    return;
                }

                // Usar a mesma função de renderização
                function renderPedidoCard(pedido) {
                    const numPropostas = pedido.propostas?.length || 0;
                    const statusBadge = '<span class="badge-status badge-concluido">Concluído</span>';

                    // Encontrar proposta aceita
                    const propostaAceita = pedido.propostas?.find(p => p.status === 'aceita');
                    const profissionalAceito = propostaAceita?.profissionalId;
                    const valorAceito = propostaAceita?.valor;

                    // Verifica se tem múltiplas fotos ou apenas uma
                    const temFotos = pedido.fotos && Array.isArray(pedido.fotos) && pedido.fotos.length > 0;
                    const temFotoUnica = pedido.foto && !temFotos;
                    const fotosParaMostrar = temFotos ? pedido.fotos : (temFotoUnica ? [pedido.foto] : []);

                    return `
                        <div class="pedido-urgente-card" style="margin-bottom: 20px; overflow: visible !important; overflow-x: visible !important; overflow-y: visible !important; max-height: none !important; height: auto !important;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div>
                                    <strong style="font-size: 18px;">${pedido.servico}</strong>
                                    ${statusBadge}
                                </div>
                            </div>
                            
                            ${fotosParaMostrar.length > 0 ? `
                                <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                    ${fotosParaMostrar.length > 1 ? 
                                        fotosParaMostrar.map((foto, idx) => `
                                            <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                        `).join('') :
                                        `<img src="${fotosParaMostrar[0]}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${fotosParaMostrar[0]}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                                    }
                                </div>
                            ` : ''}
                            
                            ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            
                            <div class="pedido-localizacao">
                                <i class="fas fa-map-marker-alt"></i> 
                                ${pedido.localizacao.endereco}, ${pedido.localizacao.cidade} - ${pedido.localizacao.estado}
                            </div>

                            ${propostaAceita && profissionalAceito ? `
                                <div class="proposta-aceita-clickable" 
                                     data-profissional-id="${profissionalAceito._id || profissionalAceito.id}" 
                                     data-pedido-id="${pedido._id}"
                                     data-servico="${pedido.servico || ''}"
                                     style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
                                     onmouseover="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(40, 167, 69, 0.1) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.5)';"
                                     onmouseout="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.3)';">
                                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                                        <div style="flex: 1;">
                                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                                <i class="fas fa-check-circle" style="color: #28a745; font-size: 16px;"></i>
                                                <strong style="color: #28a745; font-size: 14px;">Proposta Aceita</strong>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                ${profissionalAceito.foto || profissionalAceito.avatarUrl ? `
                                                    <img src="${profissionalAceito.foto || profissionalAceito.avatarUrl}" 
                                                         alt="${profissionalAceito.nome}" 
                                                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(40, 167, 69, 0.3); pointer-events: none;">
                                                ` : ''}
                                                <div style="flex: 1; min-width: 150px; pointer-events: none;">
                                                    <div style="font-weight: 600; color: var(--text-primary); font-size: 15px;">
                                                        ${profissionalAceito.nome || 'Profissional'}
                                                    </div>
                                                    ${profissionalAceito.cidade && profissionalAceito.estado ? `
                                                        <div style="font-size: 12px; color: var(--text-secondary);">
                                                            <i class="fas fa-map-marker-alt"></i> ${profissionalAceito.cidade} - ${profissionalAceito.estado}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                                ${valorAceito ? `
                                                    <div style="text-align: right; pointer-events: none;">
                                                        <div style="font-size: 18px; font-weight: 700; color: #28a745;">
                                                            R$ ${parseFloat(valorAceito).toFixed(2)}
                                                        </div>
                                                        <div style="font-size: 11px; color: var(--text-secondary);">
                                                            Valor aceito
                                                        </div>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <div style="margin-top: 15px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <strong><i class="fas fa-hand-holding-usd"></i> Propostas Recebidas: ${numPropostas}</strong>
                                    </div>
                                </div>
                            `}
                        </div>
                    `;
                }

                let html = '<h4 style="margin-bottom: 10px;">Pedidos Concluídos e Avaliados</h4>';
                html += pedidosParaMostrar.map(p => renderPedidoCard(p)).join('');

                listaPedidosConcluidos.innerHTML = html;

                // Adicionar listeners para fotos clicáveis (abrir modal)
                document.querySelectorAll('#lista-pedidos-concluidos .foto-pedido-clickable').forEach(img => {
                    img.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const fotoUrl = img.dataset.fotoUrl || img.src;
                        if (typeof window.abrirModalImagem === 'function') {
                            window.abrirModalImagem(fotoUrl);
                        }
                    });
                });
            } else {
                listaPedidosConcluidos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar pedidos concluídos.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar pedidos concluídos:', error);
            listaPedidosConcluidos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar pedidos concluídos. Tente novamente.</p>';
        }
    }

    // Listener para o botão "Concluídos"
    if (btnPedidosConcluidos) {
        btnPedidosConcluidos.addEventListener('click', async () => {
            // Fechar modal de pedidos abertos
            if (modalMeusPedidosUrgentes) {
                modalMeusPedidosUrgentes.classList.add('hidden');
            }
            // Abrir modal de pedidos concluídos
            if (modalPedidosConcluidos) {
                await carregarPedidosConcluidos();
                modalPedidosConcluidos.classList.remove('hidden');
            }
        });
    }

    // Carregar pedidos abertos automaticamente quando o modal abrir
    if (modalMeusPedidosUrgentes) {
        // Observer para detectar quando o modal é aberto
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const isHidden = modalMeusPedidosUrgentes.classList.contains('hidden');
                    if (!isHidden && modoVisualizacaoMeusPedidos === 'abertos') {
                        // Modal foi aberto e está em modo 'abertos', carregar pedidos
                        carregarMeusPedidosUrgentes('abertos');
                    }
                }
            });
        });
        
        observer.observe(modalMeusPedidosUrgentes, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Também carregar quando clicar no botão de ações rápidas (já está sendo feito no listener acima)
    }

    if (formEnviarProposta) {
        formEnviarProposta.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const pedidoId = document.getElementById('proposta-pedido-id').value;
            const valor = parseFloat(document.getElementById('proposta-valor').value);
            const tempoChegada = document.getElementById('proposta-tempo-chegada').value;
            const observacoes = document.getElementById('proposta-observacoes').value;

            try {
                const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/proposta`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        valor,
                        tempoChegada,
                        observacoes
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    // Feedback visual com check animado
                    const toast = document.createElement('div');
                    toast.className = 'toast-sucesso';
                    toast.innerHTML = '<span class="check-animado">✔</span> Proposta enviada com sucesso! O cliente será notificado.';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.classList.add('show'), 10);
                    setTimeout(() => toast.remove(), 2500);

                    formEnviarProposta.reset();
                    modalEnviarProposta?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao enviar proposta.');
                }
            } catch (error) {
                console.error('Erro ao enviar proposta:', error);
                alert('Erro ao enviar proposta.');
            }
        });
    }

    // (Botão de criar projeto de time removido da área de ações rápidas para evitar duplicidade com a seção de times)

    if (formProjetoTime) {
        formProjetoTime.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const titulo = document.getElementById('projeto-titulo').value;
            const descricao = document.getElementById('projeto-descricao').value;
            const categoria = document.getElementById('projeto-categoria').value;
            const dataServico = document.getElementById('projeto-data').value;
            const horaInicio = document.getElementById('projeto-hora-inicio').value;
            const horaFim = document.getElementById('projeto-hora-fim').value;
            const endereco = document.getElementById('projeto-endereco').value;
            const cidade = document.getElementById('projeto-cidade').value;
            const estado = document.getElementById('projeto-estado').value;
            const valorTotal = parseFloat(document.getElementById('projeto-valor-total').value);

            const profissionaisNecessarios = Array.from(profissionaisListaProjeto.children).map(item => ({
                tipo: item.querySelector('.tipo-profissional-projeto').value,
                quantidade: parseInt(item.querySelector('.qtd-profissional-projeto').value),
                valorPorPessoa: parseFloat(item.querySelector('.valor-profissional-projeto').value)
            }));

            try {
                const response = await fetch('/api/projetos-time', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        titulo,
                        descricao,
                        categoria,
                        localizacao: {
                            endereco,
                            cidade,
                            estado
                        },
                        dataServico,
                        horaInicio,
                        horaFim,
                        profissionaisNecessarios,
                        valorTotal
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Projeto de time criado com sucesso!');
                    formProjetoTime.reset();
                    modalProjetoTime?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao criar projeto.');
                }
            } catch (error) {
                console.error('Erro ao criar projeto de time:', error);
                alert('Erro ao criar projeto de time.');
            }
        });
    }

    // ============================================
    // VAGAS-RELÂMPAGO (para empresas)
    // ============================================
    
    const modalVagaRelampago = document.getElementById('modal-vaga-relampago');
    const formVagaRelampago = document.getElementById('form-vaga-relampago');
    const modalVagasRelampagoProfissional = document.getElementById('modal-vagas-relampago-profissional');
    const listaVagasRelampago = document.getElementById('lista-vagas-relampago');
    const modalCandidatosVaga = document.getElementById('modal-candidatos-vaga');

    // Adicionar botão para criar vaga-relâmpago (empresas)
    if (userType === 'empresa') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-criar-vaga-relampago')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-criar-vaga-relampago';
            btnNovo.className = 'btn-acao-lateral';
            btnNovo.innerHTML = '<i class="fas fa-bolt"></i> Criar Vaga-Relâmpago';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', () => {
                modalVagaRelampago?.classList.remove('hidden');
            });
        }

        // Adicionar botão para ver minhas vagas
        if (acoesRapidas && !document.getElementById('btn-minhas-vagas')) {
            const btnMinhasVagas = document.createElement('button');
            btnMinhasVagas.id = 'btn-minhas-vagas';
            btnMinhasVagas.className = 'btn-acao-lateral';
            btnMinhasVagas.innerHTML = '<i class="fas fa-list"></i> Minhas Vagas';
            acoesRapidas.appendChild(btnMinhasVagas);
            
            btnMinhasVagas.addEventListener('click', async () => {
                await carregarMinhasVagas();
            });
        }
    }

    // Adicionar botão para ver vagas-relâmpago (profissionais)
    if (userType === 'trabalhador') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-ver-vagas-relampago')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-ver-vagas-relampago';
            btnNovo.className = 'btn-acao-lateral';
            btnNovo.innerHTML = '<i class="fas fa-briefcase"></i> Vagas-Relâmpago';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarVagasRelampago();
                modalVagasRelampagoProfissional?.classList.remove('hidden');
            });
        }
    }

    if (formVagaRelampago) {
        formVagaRelampago.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const titulo = document.getElementById('vaga-titulo').value;
            const descricao = document.getElementById('vaga-descricao').value;
            const cargo = document.getElementById('vaga-cargo').value;
            const quantidade = parseInt(document.getElementById('vaga-quantidade').value);
            const dataServico = document.getElementById('vaga-data').value;
            const horaInicio = document.getElementById('vaga-hora-inicio').value;
            const horaFim = document.getElementById('vaga-hora-fim').value;
            const valorPorPessoa = parseFloat(document.getElementById('vaga-valor').value);
            const formaPagamento = document.getElementById('vaga-forma-pagamento').value;
            const endereco = document.getElementById('vaga-endereco').value;
            const cidade = document.getElementById('vaga-cidade').value;
            const estado = document.getElementById('vaga-estado').value;

            try {
                const response = await fetch('/api/vagas-relampago', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        titulo,
                        descricao,
                        cargo,
                        quantidade,
                        dataServico,
                        horaInicio,
                        horaFim,
                        valorPorPessoa,
                        formaPagamento,
                        localizacao: {
                            endereco,
                            cidade,
                            estado
                        }
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert(`Vaga-relâmpago criada! ${data.profissionaisNotificados} profissionais foram notificados.`);
                    formVagaRelampago.reset();
                    modalVagaRelampago?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao criar vaga-relâmpago.');
                }
            } catch (error) {
                console.error('Erro ao criar vaga-relâmpago:', error);
                alert('Erro ao criar vaga-relâmpago.');
            }
        });
    }

    async function carregarVagasRelampago() {
        if (!listaVagasRelampago) return;

        try {
            const response = await fetch('/api/vagas-relampago', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.vagas.length === 0) {
                    listaVagasRelampago.innerHTML = '<p>Nenhuma vaga-relâmpago disponível no momento.</p>';
                    return;
                }

                listaVagasRelampago.innerHTML = data.vagas.map(vaga => {
                    const empresa = vaga.empresaId;
                    const dataServico = new Date(vaga.dataServico);
                    const hoje = new Date();
                    const isHoje = dataServico.toDateString() === hoje.toDateString();
                    const tempoRestante = Math.max(0, Math.ceil((new Date(vaga.dataExpiracao) - new Date()) / 60000));
                    const vagasRestantes = vaga.quantidade - (vaga.profissionaisAceitos?.length || 0);
                    
                    return `
                        <div class="vaga-relampago-card">
                            <div class="vaga-header">
                                <div>
                                    <strong>${vaga.titulo}</strong>
                                    <span class="badge-cargo">${vaga.cargo}</span>
                                </div>
                                <span class="tempo-restante">⏱️ ${tempoRestante} min</span>
                            </div>
                            <p class="vaga-descricao">${vaga.descricao}</p>
                            <div class="vaga-info">
                                <div class="vaga-info-item">
                                    <i class="fas fa-calendar"></i> 
                                    ${isHoje ? 'Hoje' : dataServico.toLocaleDateString('pt-BR')} 
                                    ${vaga.horaInicio} - ${vaga.horaFim}
                                </div>
                                <div class="vaga-info-item">
                                    <i class="fas fa-users"></i> 
                                    ${vagasRestantes} de ${vaga.quantidade} vagas disponíveis
                                </div>
                                <div class="vaga-info-item">
                                    <i class="fas fa-dollar-sign"></i> 
                                    R$ ${vaga.valorPorPessoa.toFixed(2)} por pessoa
                                </div>
                                <div class="vaga-info-item">
                                    <i class="fas fa-map-marker-alt"></i> 
                                    ${vaga.localizacao.endereco}, ${vaga.localizacao.cidade} - ${vaga.localizacao.estado}
                                </div>
                            </div>
                            <div class="vaga-empresa">
                                <img src="${empresa?.avatarUrl || empresa?.foto || 'imagens/default-user.png'}" 
                                     alt="${empresa?.nome || 'Empresa'}" class="avatar-pequeno">
                                <span><strong>${empresa?.nome || 'Empresa'}</strong></span>
                            </div>
                            <button class="btn-candidatar-vaga" data-vaga-id="${vaga._id}">
                                <i class="fas fa-hand-paper"></i> Candidatar-se
                            </button>
                        </div>
                    `;
                }).join('');

                // Adicionar listeners para candidatar-se
                document.querySelectorAll('.btn-candidatar-vaga').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const vagaId = btn.dataset.vagaId;
                        
                        if (!confirm('Tem certeza que deseja se candidatar a esta vaga?')) return;

                        try {
                            const response = await fetch(`/api/vagas-relampago/${vagaId}/candidatar`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            const data = await response.json();
                            
                            if (data.success) {
                                alert('Candidatura enviada com sucesso! A empresa será notificada.');
                                btn.disabled = true;
                                btn.textContent = 'Candidatura Enviada';
                            } else {
                                alert(data.message || 'Erro ao enviar candidatura.');
                            }
                        } catch (error) {
                            console.error('Erro ao candidatar-se:', error);
                            alert('Erro ao enviar candidatura.');
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar vagas-relâmpago:', error);
            listaVagasRelampago.innerHTML = '<p>Erro ao carregar vagas-relâmpago.</p>';
        }
    }

    async function carregarMinhasVagas() {
        try {
            const response = await fetch('/api/vagas-relampago/empresa/minhas', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success && data.vagas.length > 0) {
                // Criar modal dinâmico para mostrar vagas
                const modal = document.createElement('div');
                modal.className = 'modal-overlay';
                modal.id = 'modal-minhas-vagas';
                modal.innerHTML = `
                    <div class="modal-content modal-grande">
                        <h2><i class="fas fa-list"></i> Minhas Vagas-Relâmpago</h2>
                        <div class="lista-propostas" style="max-height: 500px; overflow-y: auto;">
                            ${data.vagas.map(vaga => {
                                const candidatosPendentes = vaga.candidatos?.filter(c => c.status === 'pendente').length || 0;
                                const profissionaisAceitos = vaga.profissionaisAceitos?.length || 0;
                                const vagasRestantes = vaga.quantidade - profissionaisAceitos;
                                
                                return `
                                    <div class="vaga-relampago-card">
                                        <div class="vaga-header">
                                            <strong>${vaga.titulo}</strong>
                                            <span class="badge-status-${vaga.status}">${vaga.status === 'aberta' ? 'Aberta' : vaga.status === 'em_andamento' ? 'Em Andamento' : vaga.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span>
                                        </div>
                                        <p class="vaga-descricao">${vaga.descricao}</p>
                                        <div class="vaga-info">
                                            <div class="vaga-info-item">
                                                <i class="fas fa-users"></i> 
                                                ${profissionaisAceitos}/${vaga.quantidade} profissionais aceitos
                                            </div>
                                            <div class="vaga-info-item">
                                                <i class="fas fa-user-clock"></i> 
                                                ${candidatosPendentes} candidatos pendentes
                                            </div>
                                            <div class="vaga-info-item">
                                                <i class="fas fa-dollar-sign"></i> 
                                                R$ ${vaga.valorPorPessoa.toFixed(2)} por pessoa
                                            </div>
                                        </div>
                                        ${vaga.status === 'aberta' && candidatosPendentes > 0 ? `
                                            <button class="btn-ver-candidatos" data-vaga-id="${vaga._id}" data-vaga-titulo="${vaga.titulo}">
                                                <i class="fas fa-users"></i> Ver Candidatos (${candidatosPendentes})
                                            </button>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <button class="btn-secondary btn-close-modal" data-modal="modal-minhas-vagas" style="margin-top: 20px;">
                            Fechar
                        </button>
                    </div>
                `;
                
                document.body.appendChild(modal);
                modal.classList.remove('hidden');

                // Adicionar listeners para ver candidatos
                document.querySelectorAll('.btn-ver-candidatos').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const vagaId = btn.dataset.vagaId;
                        const vagaTitulo = btn.dataset.vagaTitulo;
                        await carregarCandidatosVaga(vagaId, vagaTitulo);
                        modal.classList.add('hidden');
                    });
                });
            } else {
                alert('Você ainda não criou nenhuma vaga-relâmpago.');
            }
        } catch (error) {
            console.error('Erro ao carregar minhas vagas:', error);
            alert('Erro ao carregar suas vagas.');
        }
    }

    async function carregarCandidatosVaga(vagaId, vagaTitulo) {
        const listaCandidatos = document.getElementById('lista-candidatos-vaga');
        const listaAceitos = document.getElementById('lista-aceitos-vaga');
        const tituloCandidatos = document.getElementById('vaga-titulo-candidatos');
        const infoCandidatos = document.getElementById('vaga-info-candidatos');
        
        if (!listaCandidatos || !modalCandidatosVaga) return;

        try {
            const response = await fetch(`/api/vagas-relampago/${vagaId}/candidatos`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                tituloCandidatos.textContent = vagaTitulo;
                infoCandidatos.textContent = `${data.quantidadeAceita}/${data.quantidadeNecessaria} profissionais aceitos`;

                const candidatosPendentes = data.candidatos.filter(c => c.status === 'pendente');
                
                if (candidatosPendentes.length === 0) {
                    listaCandidatos.innerHTML = '<p>Nenhum candidato pendente.</p>';
                } else {
                    listaCandidatos.innerHTML = candidatosPendentes.map(candidato => {
                        const prof = candidato.profissionalId;
                        const nivel = prof.gamificacao?.nivel || 1;
                        const mediaAvaliacao = prof.mediaAvaliacao || 0;
                        const totalAvaliacoes = prof.totalAvaliacoes || 0;
                        
                        return `
                            <div class="candidato-card">
                                <div class="candidato-header">
                                    <img src="${prof.avatarUrl || prof.foto || 'imagens/default-user.png'}" 
                                         alt="${prof.nome}" class="proposta-avatar">
                                    <div class="candidato-info">
                                        <strong>${prof.nome}</strong>
                                        <div class="candidato-meta">
                                            <span>Nível ${nivel}</span>
                                            ${mediaAvaliacao > 0 ? `<span>⭐ ${mediaAvaliacao.toFixed(1)} (${totalAvaliacoes})</span>` : '<span>Sem avaliações</span>'}
                                            <span>${prof.cidade || ''} - ${prof.estado || ''}</span>
                                        </div>
                                        ${prof.atuacao ? `<small>${prof.atuacao}</small>` : ''}
                                    </div>
                                </div>
                                <div class="candidato-acoes">
                                    <button class="btn-aceitar-candidato" data-vaga-id="${vagaId}" data-candidato-id="${candidato._id}">
                                        <i class="fas fa-check"></i> Aceitar
                                    </button>
                                    <button class="btn-rejeitar-candidato" data-vaga-id="${vagaId}" data-candidato-id="${candidato._id}">
                                        <i class="fas fa-times"></i> Rejeitar
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Adicionar listeners para aceitar/rejeitar
                    document.querySelectorAll('.btn-aceitar-candidato').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const vagaId = btn.dataset.vagaId;
                            const candidatoId = btn.dataset.candidatoId;
                            await avaliarCandidato(vagaId, candidatoId, 'aceitar');
                        });
                    });

                    document.querySelectorAll('.btn-rejeitar-candidato').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const vagaId = btn.dataset.vagaId;
                            const candidatoId = btn.dataset.candidatoId;
                            await avaliarCandidato(vagaId, candidatoId, 'rejeitar');
                        });
                    });
                }

                // Mostrar profissionais aceitos
                if (data.profissionaisAceitos && data.profissionaisAceitos.length > 0) {
                    listaAceitos.innerHTML = data.profissionaisAceitos.map(prof => `
                        <div class="candidato-card" style="border-left-color: #28a745;">
                            <div class="candidato-header">
                                <img src="${prof.avatarUrl || prof.foto || 'imagens/default-user.png'}" 
                                     alt="${prof.nome}" class="proposta-avatar">
                                <div class="candidato-info">
                                    <strong>${prof.nome}</strong>
                                    <span class="badge-aceito"><i class="fas fa-check-circle"></i> Aceito</span>
                                </div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    listaAceitos.innerHTML = '<p style="color: var(--text-secondary);">Nenhum profissional aceito ainda.</p>';
                }

                modalCandidatosVaga.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Erro ao carregar candidatos:', error);
            alert('Erro ao carregar candidatos.');
        }
    }

    async function avaliarCandidato(vagaId, candidatoId, acao) {
        try {
            const response = await fetch(`/api/vagas-relampago/${vagaId}/candidatos/${candidatoId}/avaliar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ acao })
            });

            const data = await response.json();
            
            if (data.success) {
                alert(data.message);
                // Recarregar candidatos
                const vagaTitulo = document.getElementById('vaga-titulo-candidatos').textContent;
                await carregarCandidatosVaga(vagaId, vagaTitulo);
            } else {
                alert(data.message || 'Erro ao avaliar candidato.');
            }
        } catch (error) {
            console.error('Erro ao avaliar candidato:', error);
            alert('Erro ao avaliar candidato.');
        }
    }

    // ============================================
    // SISTEMA DE PAGAMENTO SEGURO (ESCROW)
    // ============================================
    
    const modalPagamentoSeguro = document.getElementById('modal-pagamento-seguro');
    const formPagamentoSeguro = document.getElementById('form-pagamento-seguro');
    const modalLiberarPagamento = document.getElementById('modal-liberar-pagamento');
    const modalMeusPagamentos = document.getElementById('modal-meus-pagamentos');
    const modalPagamentosGarantidos = document.getElementById('modal-pagamentos-garantidos');

    // Função para abrir modal de pagamento seguro
    window.abrirPagamentoSeguro = function(tipoServico, servicoId, valor, titulo, descricao) {
        if (!modalPagamentoSeguro || !formPagamentoSeguro) return;

        document.getElementById('pagamento-tipo-servico').value = tipoServico;
        document.getElementById('pagamento-servico-id').value = servicoId;
        document.getElementById('pagamento-valor').value = valor;
        document.getElementById('pagamento-valor-input').value = valor.toFixed(2);
        document.getElementById('servico-titulo-pagamento').textContent = titulo || 'Serviço';
        document.getElementById('servico-descricao-pagamento').textContent = descricao || '';

        // Calcula valores
        atualizarValoresPagamento(valor);

        modalPagamentoSeguro.classList.remove('hidden');
    };

    // Função para atualizar valores do pagamento
    function atualizarValoresPagamento(valor) {
        const taxa = valor * 0.05; // 5%
        const total = valor + taxa;
        const valorLiquido = valor - taxa;

        document.getElementById('pagamento-taxa').textContent = `R$ ${taxa.toFixed(2)}`;
        document.getElementById('pagamento-total').textContent = `R$ ${total.toFixed(2)}`;
        document.getElementById('pagamento-valor-liquido').textContent = `R$ ${valorLiquido.toFixed(2)}`;
    }

    // Listener para mudanças no valor (caso seja editável no futuro)
    const valorInput = document.getElementById('pagamento-valor-input');
    if (valorInput) {
        valorInput.addEventListener('input', function() {
            const valor = parseFloat(this.value) || 0;
            atualizarValoresPagamento(valor);
        });
    }

    // Submissão do formulário de pagamento
    if (formPagamentoSeguro) {
        formPagamentoSeguro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tipoServico = document.getElementById('pagamento-tipo-servico').value;
            const servicoId = document.getElementById('pagamento-servico-id').value;
            const valor = parseFloat(document.getElementById('pagamento-valor').value);
            const metodoPagamento = document.getElementById('pagamento-metodo').value;

            const body = {
                tipoServico,
                valor,
                metodoPagamento
            };

            // Adiciona ID específico baseado no tipo
            if (tipoServico === 'agendamento') {
                body.agendamentoId = servicoId;
            } else if (tipoServico === 'pedido_urgente') {
                body.pedidoUrgenteId = servicoId;
            }

            try {
                const response = await fetch('/api/pagamento-seguro', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Pagamento seguro criado! O profissional foi notificado que o pagamento está garantido.');
                    modalPagamentoSeguro.classList.add('hidden');
                    formPagamentoSeguro.reset();
                    
                    // Recarrega dados se necessário
                    if (window.carregarPedidosUrgentes) {
                        await window.carregarPedidosUrgentes();
                    }
                } else {
                    alert(data.message || 'Erro ao processar pagamento.');
                }
            } catch (error) {
                console.error('Erro ao processar pagamento:', error);
                alert('Erro ao processar pagamento.');
            }
        });
    }

    // Função para liberar pagamento
    window.liberarPagamento = async function(pagamentoId) {
        if (!confirm('Tem certeza que deseja liberar o pagamento? O serviço foi concluído com sucesso?')) {
            return;
        }

        try {
            const response = await fetch(`/api/pagamento-seguro/${pagamentoId}/liberar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                alert(data.message || 'Pagamento liberado com sucesso!');
                modalLiberarPagamento.classList.add('hidden');
                
                // Recarrega pagamentos
                if (userType === 'cliente') {
                    await carregarPagamentosCliente();
                } else if (userType === 'trabalhador') {
                    await carregarPagamentosProfissional();
                }
            } else {
                alert(data.message || 'Erro ao liberar pagamento.');
            }
        } catch (error) {
            console.error('Erro ao liberar pagamento:', error);
            alert('Erro ao liberar pagamento.');
        }
    };

    // Função para abrir modal de liberar pagamento
    window.abrirModalLiberarPagamento = function(pagamento) {
        if (!modalLiberarPagamento) return;

        document.getElementById('liberar-valor-servico').textContent = `R$ ${pagamento.valor.toFixed(2)}`;
        document.getElementById('liberar-taxa').textContent = `R$ ${pagamento.taxaPlataforma.toFixed(2)}`;
        const valorLiquido = pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma);
        document.getElementById('liberar-valor-liquido').textContent = `R$ ${valorLiquido.toFixed(2)}`;

        const btnConfirmar = document.getElementById('btn-confirmar-liberar');
        if (btnConfirmar) {
            btnConfirmar.onclick = () => window.liberarPagamento(pagamento._id);
        }

        modalLiberarPagamento.classList.remove('hidden');
    };

    // Carregar pagamentos do cliente
    async function carregarPagamentosCliente() {
        const listaPagamentos = document.getElementById('lista-pagamentos-cliente');
        if (!listaPagamentos) return;

        try {
            const response = await fetch('/api/pagamento-seguro/cliente', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.pagamentos.length === 0) {
                    listaPagamentos.innerHTML = '<p>Você ainda não tem pagamentos seguros.</p>';
                    return;
                }

                listaPagamentos.innerHTML = data.pagamentos.map(pagamento => {
                    const profissional = pagamento.profissionalId;
                    const valorLiquido = pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma);
                    const statusBadge = {
                        'pendente': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pendente</span>',
                        'pago': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pagamento Garantido</span>',
                        'liberado': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Liberado</span>',
                        'reembolsado': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Reembolsado</span>',
                        'cancelado': '<span style="background: #dc3545; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Cancelado</span>'
                    }[pagamento.status] || '';

                    return `
                        <div class="pagamento-card" data-pagamento-id="${pagamento._id}">
                            <div class="pagamento-header">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${profissional?.avatarUrl || profissional?.foto || 'imagens/default-user.png'}" 
                                         alt="${profissional?.nome || 'Profissional'}" class="avatar-pequeno">
                                    <div>
                                        <strong>${profissional?.nome || 'Profissional'}</strong>
                                        ${profissional?.atuacao ? `<small style="color: var(--text-secondary);">${profissional.atuacao}</small>` : ''}
                                    </div>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="pagamento-info">
                                <div style="display: flex; justify-content: space-between; margin: 15px 0;">
                                    <span>Valor do Serviço:</span>
                                    <strong>R$ ${pagamento.valor.toFixed(2)}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                                    <span>Profissional receberá:</span>
                                    <strong style="color: #28a745;">R$ ${valorLiquido.toFixed(2)}</strong>
                                </div>
                                ${pagamento.temGarantiaHelpy ? '<p style="color: #007bff; font-size: 14px;"><i class="fas fa-shield-alt"></i> Garantia Helpy ativa - XP em dobro!</p>' : ''}
                            </div>
                            ${pagamento.status === 'pago' ? `
                                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                                    <button class="btn-liberar-pagamento" data-pagamento='${JSON.stringify(pagamento)}' style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; flex: 1;">
                                        <i class="fas fa-check"></i> Liberar Pagamento
                                    </button>
                                    <button class="btn-reembolsar-pagamento" data-pagamento-id="${pagamento._id}" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; flex: 1;">
                                        <i class="fas fa-undo"></i> Solicitar Reembolso
                                    </button>
                                    <button class="btn-abrir-disputa" onclick="window.abrirCriarDisputa('${pagamento._id}')" style="background: #ffc107; color: #333; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; flex: 1; margin-top: 5px;">
                                        <i class="fas fa-gavel"></i> Abrir Disputa
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');

                // Adicionar listeners para botões de ação
                document.querySelectorAll('.btn-liberar-pagamento').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const pagamentoData = JSON.parse(this.getAttribute('data-pagamento'));
                        window.abrirModalLiberarPagamento(pagamentoData);
                    });
                });

                document.querySelectorAll('.btn-reembolsar-pagamento').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const pagamentoId = this.getAttribute('data-pagamento-id');
                        window.solicitarReembolso(pagamentoId);
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar pagamentos:', error);
            listaPagamentos.innerHTML = '<p>Erro ao carregar pagamentos.</p>';
        }
    }

    // Carregar pagamentos do profissional
    async function carregarPagamentosProfissional() {
        const listaPagamentos = document.getElementById('lista-pagamentos-profissional');
        const totalRecebido = document.getElementById('total-recebido');
        const totalAReceber = document.getElementById('total-a-receber');
        const totalServicos = document.getElementById('total-servicos');
        
        if (!listaPagamentos) return;

        try {
            const response = await fetch('/api/pagamento-seguro/profissional', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                // Atualiza resumo
                if (totalRecebido) totalRecebido.textContent = `R$ ${data.resumo.totalRecebido}`;
                if (totalAReceber) totalAReceber.textContent = `R$ ${data.resumo.totalAReceber}`;
                if (totalServicos) totalServicos.textContent = data.resumo.totalPagamentos;

                if (data.pagamentos.length === 0) {
                    listaPagamentos.innerHTML = '<p>Você ainda não tem pagamentos garantidos.</p>';
                    return;
                }

                listaPagamentos.innerHTML = data.pagamentos.map(pagamento => {
                    const cliente = pagamento.clienteId;
                    const valorLiquido = pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma);
                    const statusBadge = {
                        'pendente': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aguardando Pagamento</span>',
                        'pago': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">💰 Pagamento Garantido</span>',
                        'liberado': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✅ Liberado</span>',
                        'reembolsado': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Reembolsado</span>',
                        'cancelado': '<span style="background: #dc3545; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Cancelado</span>'
                    }[pagamento.status] || '';

                    return `
                        <div class="pagamento-card" style="border-left: 4px solid ${pagamento.status === 'pago' ? '#007bff' : pagamento.status === 'liberado' ? '#28a745' : '#ffc107'};">
                            <div class="pagamento-header">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${cliente?.avatarUrl || cliente?.foto || 'imagens/default-user.png'}" 
                                         alt="${cliente?.nome || 'Cliente'}" class="avatar-pequeno">
                                    <div>
                                        <strong>${cliente?.nome || 'Cliente'}</strong>
                                        <small style="color: var(--text-secondary);">${pagamento.tipoServico === 'agendamento' ? 'Agendamento' : 'Pedido Urgente'}</small>
                                    </div>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="pagamento-info">
                                <div style="display: flex; justify-content: space-between; margin: 15px 0;">
                                    <span>Valor do Serviço:</span>
                                    <strong>R$ ${pagamento.valor.toFixed(2)}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                                    <span>Você receberá:</span>
                                    <strong style="color: #28a745; font-size: 18px;">R$ ${valorLiquido.toFixed(2)}</strong>
                                </div>
                                ${pagamento.temGarantiaHelpy ? '<p style="color: #007bff; font-size: 14px;"><i class="fas fa-shield-alt"></i> Garantia Helpy - Você receberá XP em dobro!</p>' : ''}
                                ${pagamento.status === 'pago' ? '<p style="color: #28a745; font-weight: bold; margin-top: 10px;"><i class="fas fa-check-circle"></i> Pagamento garantido! Pode realizar o serviço com segurança.</p>' : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar pagamentos:', error);
            listaPagamentos.innerHTML = '<p>Erro ao carregar pagamentos.</p>';
        }
    }

    // Função para solicitar reembolso
    window.solicitarReembolso = async function(pagamentoId) {
        const motivo = prompt('Informe o motivo do reembolso:');
        if (!motivo) return;

        if (!confirm('Tem certeza que deseja solicitar reembolso? O valor será devolvido em até 5 dias úteis.')) {
            return;
        }

        try {
            const response = await fetch(`/api/pagamento-seguro/${pagamentoId}/reembolsar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ motivo })
            });

            const data = await response.json();
            
            if (data.success) {
                alert(data.message || 'Reembolso processado com sucesso!');
                await carregarPagamentosCliente();
            } else {
                alert(data.message || 'Erro ao processar reembolso.');
            }
        } catch (error) {
            console.error('Erro ao solicitar reembolso:', error);
            alert('Erro ao solicitar reembolso.');
        }
    };

    // Adicionar botões na lateral para clientes e profissionais
    if (userType === 'cliente') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-meus-pagamentos')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-meus-pagamentos';
            btnNovo.className = 'btn-acao-lateral';
            btnNovo.innerHTML = '<i class="fas fa-wallet"></i> Meus Pagamentos';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarPagamentosCliente();
                modalMeusPagamentos?.classList.remove('hidden');
            });
        }
    }

    if (userType === 'trabalhador') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-pagamentos-garantidos')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-pagamentos-garantidos';
            btnNovo.className = 'btn-acao-lateral';
            btnNovo.innerHTML = '<i class="fas fa-shield-alt"></i> Pagamentos Garantidos';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarPagamentosProfissional();
                modalPagamentosGarantidos?.classList.remove('hidden');
            });
        }
    }

    // ============================================
    // SISTEMA DE NOTIFICAÇÕES
    // ============================================
    
    const btnNotificacoes = document.getElementById('btn-notificacoes');
    const badgeNotificacoes = document.getElementById('badge-notificacoes');
    const modalNotificacoes = document.getElementById('modal-notificacoes');
    const listaNotificacoes = document.getElementById('lista-notificacoes');
    const btnMarcarTodasLidas = document.getElementById('btn-marcar-todas-lidas');

    // Modal genérico de confirmação (para concluir/cancelar serviço, aceitar proposta, etc.)
    const modalConfirmacao = document.getElementById('modal-confirmacao-acao');
    const confirmacaoTitulo = document.getElementById('confirmacao-titulo');
    const confirmacaoTexto = document.getElementById('confirmacao-texto');
    const confirmacaoMotivoGroup = document.getElementById('confirmacao-motivo-group');
    const confirmacaoMotivoInput = document.getElementById('confirmacao-motivo');
    const btnConfirmacaoOk = document.getElementById('confirmacao-ok');
    const btnConfirmacaoCancelar = document.getElementById('confirmacao-cancelar');

    let confirmacaoHandler = null;
    let confirmacaoExigeMotivo = false;

    function abrirConfirmacaoAcao({ titulo, texto, exigeMotivo = false, onConfirm }) {
        if (!modalConfirmacao) return;
        confirmacaoTitulo.textContent = titulo || 'Confirmar ação';
        confirmacaoTexto.textContent = texto || 'Tem certeza que deseja continuar?';
        confirmacaoMotivoGroup.style.display = exigeMotivo ? 'block' : 'none';
        confirmacaoMotivoInput.value = '';
        confirmacaoExigeMotivo = exigeMotivo;
        confirmacaoHandler = onConfirm || null;
        modalConfirmacao.classList.remove('hidden');
    }

    function fecharConfirmacaoAcao() {
        if (!modalConfirmacao) return;
        modalConfirmacao.classList.add('hidden');
        confirmacaoHandler = null;
        confirmacaoMotivoInput.value = '';
    }

    if (btnConfirmacaoOk) {
        btnConfirmacaoOk.addEventListener('click', async () => {
            if (!confirmacaoHandler) {
                fecharConfirmacaoAcao();
                return;
            }
            const motivo = confirmacaoMotivoInput.value.trim();
            if (confirmacaoExigeMotivo && !motivo) {
                alert('Por favor, informe um motivo.');
                return;
            }
            const handler = confirmacaoHandler;
            fecharConfirmacaoAcao();
            await handler(motivo);
        });
    }

    if (btnConfirmacaoCancelar) {
        btnConfirmacaoCancelar.addEventListener('click', () => {
            fecharConfirmacaoAcao();
        });
    }

    // Carregar notificações periodicamente
    async function carregarNotificacoes() {
        if (!badgeNotificacoes && !listaNotificacoes) return;
        // Se não estiver logado, não tenta carregar notificações
        if (!token || !localStorage.getItem('userId')) {
            if (badgeNotificacoes) {
                badgeNotificacoes.style.display = 'none';
            }
            if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Faça login para ver suas notificações.</p>';
            }
            return;
        }
        
        try {
            const response = await fetch('/api/notificacoes?limit=50', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Atualiza badge
                if (badgeNotificacoes) {
                    if (data.totalNaoLidas > 0) {
                        badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                        badgeNotificacoes.style.display = 'flex';
                    } else {
                        badgeNotificacoes.style.display = 'none';
                    }
                }

                // Se modal está aberto, atualiza lista
                if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                    const notificacoes = data.notificacoes || [];
                    if (notificacoes.length === 0) {
                        listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhuma notificação.</p>';
                    } else {
                        listaNotificacoes.innerHTML = notificacoes.map(notif => {
                            const dataFormatada = new Date(notif.createdAt).toLocaleString('pt-BR');
                            const iconMap = {
                                'pagamento_garantido': '💰',
                                'pagamento_liberado': '✅',
                                'pagamento_reembolsado': '💸',
                                'disputa_aberta': '⚖️',
                                'disputa_resolvida': '⚖️',
                                'proposta_aceita': '🎉',
                                'proposta_pedido_urgente': '💼',
                                'pedido_urgente': '⚡',
                                'servico_concluido': '✨',
                                'avaliacao_recebida': '⭐'
                            };
                            
                            return `
                                <div class="notificacao-card ${notif.lida ? '' : 'nao-lida'}" data-notif-id="${notif._id}">
                                    <div style="display: flex; gap: 15px; align-items: flex-start;">
                                        <div style="font-size: 24px;">${iconMap[notif.tipo] || '🔔'}</div>
                                        <div style="flex: 1;">
                                            <strong>${notif.titulo || 'Notificação'}</strong>
                                            <p style="margin: 5px 0; color: var(--text-secondary);">${notif.mensagem || ''}</p>
                                            <small style="color: var(--text-secondary);">${dataFormatada}</small>
                                        </div>
                                        ${!notif.lida ? '<span style="background: #007bff; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-top: 5px;"></span>' : ''}
                                    </div>
                                </div>
                            `;
                        }).join('');

                        // Adiciona listeners para marcar como lida ao clicar e abrir ações relacionadas
                        document.querySelectorAll('.notificacao-card').forEach(card => {
                            card.addEventListener('click', async () => {
                                const notifId = card.dataset.notifId;
                                if (notifId) {
                                    await marcarNotificacaoLida(notifId);
                                    
                                    // Localiza a notificação completa
                                    const notif = notificacoes.find(n => n._id === notifId);
                                    
                                    // Se for notificação de proposta de pedido urgente, abre o modal de propostas
                                    if (notif && notif.tipo === 'proposta_pedido_urgente' && notif.dadosAdicionais?.pedidoId) {
                                        modalNotificacoes?.classList.add('hidden');
                                        await carregarPropostas(notif.dadosAdicionais.pedidoId);
                                    }

                                    // Se for notificação de proposta aceita, abre Serviços Ativos e destaca o pedido
                                    if (notif && notif.tipo === 'proposta_aceita' && notif.dadosAdicionais?.agendamentoId) {
                                        modalNotificacoes?.classList.add('hidden');
                                        await carregarServicosAtivos(notif.dadosAdicionais.pedidoId);
                                        modalServicosAtivos?.classList.remove('hidden');
                                    }

                                    // Se for notificação de serviço concluído, abre página de avaliação do profissional
                                    if (notif && notif.tipo === 'servico_concluido' && notif.dadosAdicionais?.profissionalId) {
                                        modalNotificacoes?.classList.add('hidden');
                                        const profissionalId = notif.dadosAdicionais.profissionalId;
                                        const agendamentoId = notif.dadosAdicionais.agendamentoId || '';
                                        const fotoServico = notif.dadosAdicionais.foto || '';
                                        const pedidoId = notif.dadosAdicionais.pedidoId || '';
                                        let pidClean = '';
                                        if (pedidoId) {
                                            pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                        }
                                        // Tenta descobrir o nome do serviço
                                        let nomeServico = notif.dadosAdicionais?.servico || '';
                                        if (!nomeServico && pidClean) {
                                            try {
                                                const respPedido = await fetch(`/api/pedidos-urgentes/${pidClean}`, { headers: { 'Authorization': `Bearer ${token}` } });
                                                if (respPedido.ok) {
                                                    const pedido = await respPedido.json();
                                                    nomeServico =
                                                        pedido?.servico ||
                                                        pedido?.titulo ||
                                                        pedido?.descricao ||
                                                        pedido?.categoria ||
                                                        pedido?.nome ||
                                                        '';
                                                }
                                            } catch (e) {
                                                console.warn('Falha ao buscar nome do serviço do pedido', e);
                                            }
                                        }
                                        if (nomeServico) {
                                            try {
                                                localStorage.setItem('ultimoServicoNome', nomeServico);
                                                localStorage.setItem('ultimaDescricaoPedido', nomeServico);
                                                localStorage.setItem('nomeServicoConcluido', nomeServico);
                                            } catch (e) {
                                                console.warn('Falha ao cachear nome do serviço', e);
                                            }
                                        }
                                        if (fotoServico) {
                                            localStorage.setItem('fotoUltimoServicoConcluido', fotoServico);
                                            localStorage.setItem('ultimaFotoPedido', fotoServico);
                                            if (pidClean) {
                                                localStorage.setItem(`fotoPedido:${pidClean}`, fotoServico);
                                                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                                            }
                                        } else if (pidClean) {
                                            // tenta reaproveitar cache se a notificação não trouxe foto
                                            const fotoCache = localStorage.getItem(`fotoPedido:${pidClean}`) || localStorage.getItem('fotoUltimoServicoConcluido') || localStorage.getItem('ultimaFotoPedido');
                                            if (fotoCache) {
                                                localStorage.setItem('fotoUltimoServicoConcluido', fotoCache);
                                                localStorage.setItem('ultimaFotoPedido', fotoCache);
                                                localStorage.setItem(`fotoPedido:${pidClean}`, fotoCache);
                                                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                                            }
                                        }
                                        // Abre o perfil do profissional já focado na seção de avaliação,
                                        // passando o agendamento para criar avaliação verificada
                                        const params = new URLSearchParams({
                                            id: profissionalId,
                                            origem: 'servico_concluido',
                                            agendamentoId
                                        });
                                        const fotoParam = fotoServico 
                                            || (pedidoId ? localStorage.getItem(`fotoPedido:${String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || ''}`) : null) 
                                            || localStorage.getItem('fotoUltimoServicoConcluido') 
                                            || localStorage.getItem('ultimaFotoPedido');
                                        if (fotoParam) params.set('foto', fotoParam);
                                        if (pedidoId) {
                                            const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                            if (pidClean) params.set('pedidoId', pidClean);
                                        }
                                        if (nomeServico) params.set('servico', nomeServico);
                                        window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                    }
                                }
                            });
                        });
                    }
                }
            } else {
                console.error('Erro na resposta de notificações:', data.message);
                if (listaNotificacoes) {
                    listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações.</p>';
                }
            }
        } catch (error) {
            console.error('Erro ao carregar notificações:', error);
            if (listaNotificacoes) {
                listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações. Tente novamente.</p>';
            }
            if (badgeNotificacoes) {
                badgeNotificacoes.style.display = 'none';
            }
        }
    }

    async function marcarNotificacaoLida(notifId) {
        try {
            await fetch(`/api/notificacoes/${notifId}/lida`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            await carregarNotificacoes();
        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
        }
    }

    if (btnNotificacoes) {
        // Abre/fecha o dropdown de notificações embaixo do botão
        btnNotificacoes.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!modalNotificacoes) return;

            const estaOculto = modalNotificacoes.classList.contains('hidden');

            // Se já está aberto, fecha
            if (!estaOculto) {
                modalNotificacoes.classList.add('hidden');
                return;
            }

            // Abrindo: mostra o dropdown e carrega as notificações
            if (listaNotificacoes) {
                listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando notificações...</p>';
            }
            modalNotificacoes.classList.remove('hidden');

            await carregarNotificacoes();

            // Ao abrir o dropdown, marca automaticamente TODAS como lidas
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                // Atualiza badge e lista após marcar como lidas
                await carregarNotificacoes();
            } catch (error) {
                console.error('Erro ao marcar todas notificações como lidas ao abrir:', error);
            }
        });

        // Fecha o dropdown ao clicar fora da caixinha de notificações
        document.addEventListener('click', (e) => {
            if (!modalNotificacoes || modalNotificacoes.classList.contains('hidden')) return;
            const cliqueDentroDropdown = modalNotificacoes.contains(e.target);
            const cliqueNoBotao = btnNotificacoes.contains(e.target);
            if (!cliqueDentroDropdown && !cliqueNoBotao) {
                modalNotificacoes.classList.add('hidden');
            }
        });
    }

    if (btnMarcarTodasLidas) {
        btnMarcarTodasLidas.addEventListener('click', async () => {
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                await carregarNotificacoes();
            } catch (error) {
                console.error('Erro ao marcar todas como lidas:', error);
            }
        });
    }

    // Carrega notificações a cada 30 segundos
    setInterval(carregarNotificacoes, 30000);
    carregarNotificacoes(); // Carrega imediatamente

    // ============================================
    // SISTEMA DE DISPUTAS
    // ============================================
    
    const modalCriarDisputa = document.getElementById('modal-criar-disputa');
    const formCriarDisputa = document.getElementById('form-criar-disputa');
    const modalMinhasDisputas = document.getElementById('modal-minhas-disputas');

    // Função para abrir modal de criar disputa
    window.abrirCriarDisputa = function(pagamentoId) {
        if (!modalCriarDisputa) return;
        document.getElementById('disputa-pagamento-id').value = pagamentoId;
        modalCriarDisputa.classList.remove('hidden');
    };

    if (formCriarDisputa) {
        formCriarDisputa.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const pagamentoId = document.getElementById('disputa-pagamento-id').value;
            const tipo = document.getElementById('disputa-tipo').value;
            const motivo = document.getElementById('disputa-motivo').value;
            const evidencias = [
                document.getElementById('disputa-evidencia-1').value,
                document.getElementById('disputa-evidencia-2').value,
                document.getElementById('disputa-evidencia-3').value
            ].filter(e => e.trim() !== '');

            try {
                const response = await fetch('/api/disputas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        pagamentoId,
                        tipo,
                        motivo,
                        evidencias
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Disputa criada com sucesso! Nossa equipe analisará o caso em até 48 horas.');
                    formCriarDisputa.reset();
                    modalCriarDisputa.classList.add('hidden');
                    await carregarDisputas();
                } else {
                    alert(data.message || 'Erro ao criar disputa.');
                }
            } catch (error) {
                console.error('Erro ao criar disputa:', error);
                alert('Erro ao criar disputa.');
            }
        });
    }

    async function carregarDisputas() {
        const listaDisputas = document.getElementById('lista-disputas');
        if (!listaDisputas) return;

        try {
            const response = await fetch('/api/disputas', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.disputas.length === 0) {
                    listaDisputas.innerHTML = '<p>Você não tem disputas.</p>';
                    return;
                }

                listaDisputas.innerHTML = data.disputas.map(disputa => {
                    const pagamento = disputa.pagamentoId;
                    const statusBadge = {
                        'aberta': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aberta</span>',
                        'em_analise': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Em Análise</span>',
                        'resolvida_cliente': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida (Favorável ao Cliente)</span>',
                        'resolvida_profissional': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida (Favorável ao Profissional)</span>',
                        'cancelada': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Cancelada</span>'
                    }[disputa.status] || '';

                    return `
                        <div class="disputa-card">
                            <div class="disputa-header">
                                <div>
                                    <strong>Disputa #${disputa._id.toString().substring(0, 8)}</strong>
                                    <p style="margin: 5px 0; color: var(--text-secondary);">Pagamento: R$ ${pagamento?.valor?.toFixed(2) || '0.00'}</p>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="disputa-info">
                                <p><strong>Tipo:</strong> ${disputa.tipo.replace(/_/g, ' ')}</p>
                                <p><strong>Motivo:</strong> ${disputa.motivo}</p>
                                ${disputa.resolucao ? `<p><strong>Resolução:</strong> ${disputa.resolucao}</p>` : ''}
                                <small style="color: var(--text-secondary);">Criada em: ${new Date(disputa.createdAt).toLocaleString('pt-BR')}</small>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar disputas:', error);
            listaDisputas.innerHTML = '<p>Erro ao carregar disputas.</p>';
        }
    }

    // (Botão lateral de "Minhas Disputas" removido para simplificar a navegação)

    // Adicionar botão "Abrir Disputa" nos cards de pagamento quando status é "pago"
    // Isso será feito dinamicamente quando os pagamentos forem renderizados

    // ============================================
    // DASHBOARD ADMINISTRATIVO
    // ============================================
    
    const modalDashboardAdmin = document.getElementById('modal-dashboard-admin');
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminTabContents = document.querySelectorAll('.admin-tab-content');

    // Sistema de abas
    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Remove active de todos
            adminTabBtns.forEach(b => b.classList.remove('active'));
            adminTabContents.forEach(c => c.classList.remove('active'));
            
            // Adiciona active no selecionado
            btn.classList.add('active');
            document.getElementById(`admin-tab-${tab}`).classList.add('active');
            
            // Carrega conteúdo da aba
            if (tab === 'pagamentos') {
                carregarAdminPagamentos();
            } else if (tab === 'disputas') {
                carregarAdminDisputas();
            } else if (tab === 'financeiro') {
                carregarAdminFinanceiro();
            }
        });
    });

    async function carregarDashboardAdmin() {
        if (!modalDashboardAdmin) return;

        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                const stats = data.dashboard.estatisticas;
                
                // Preenche cards de estatísticas
                const adminEstatisticas = document.getElementById('admin-estatisticas');
                if (adminEstatisticas) {
                    adminEstatisticas.innerHTML = `
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Total de Pagamentos</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.totalPagamentos}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Pagamentos Este Mês</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.pagamentosMes}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Receita do Mês</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">R$ ${parseFloat(stats.receitaMes).toFixed(2)}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Disputas Abertas</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.disputasAbertas}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Pagamentos Pendentes</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.pagamentosPendentes}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Receita do Ano</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">R$ ${parseFloat(stats.receitaAno).toFixed(2)}</div>
                        </div>
                    `;
                }

                // Preenche lista de pagamentos
                carregarAdminPagamentos(data.dashboard.pagamentosRecentes);
                
                // Preenche lista de disputas
                carregarAdminDisputas(data.dashboard.disputasRecentes);
                
                // Preenche resumo financeiro
                carregarAdminFinanceiro(stats);
            }
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            if (error.message.includes('403')) {
                alert('Acesso negado. Apenas administradores podem acessar o dashboard.');
            }
        }
    }

    async function carregarAdminPagamentos(pagamentos = null) {
        const lista = document.getElementById('admin-lista-pagamentos');
        if (!lista) return;

        if (!pagamentos) {
            // Se não foram passados, busca do dashboard
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                pagamentos = data.dashboard.pagamentosRecentes;
            }
        }

        if (!pagamentos || pagamentos.length === 0) {
            lista.innerHTML = '<p>Nenhum pagamento recente.</p>';
            return;
        }

        lista.innerHTML = pagamentos.map(p => {
            const cliente = p.clienteId;
            const profissional = p.profissionalId;
            const valorLiquido = p.valorLiquido || (p.valor - p.taxaPlataforma);
            const statusBadge = {
                'pendente': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pendente</span>',
                'pago': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pago</span>',
                'liberado': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Liberado</span>',
                'reembolsado': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Reembolsado</span>'
            }[p.status] || '';

            return `
                <div class="admin-pagamento-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${cliente?.nome || 'Cliente'} → ${profissional?.nome || 'Profissional'}</strong>
                            <p style="margin: 5px 0; color: var(--text-secondary);">
                                ${p.tipoServico === 'agendamento' ? 'Agendamento' : 'Pedido Urgente'} • 
                                R$ ${p.valor.toFixed(2)} • 
                                Taxa: R$ ${p.taxaPlataforma.toFixed(2)}
                            </p>
                            <small style="color: var(--text-secondary);">${new Date(p.createdAt).toLocaleString('pt-BR')}</small>
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function carregarAdminDisputas(disputas = null) {
        const lista = document.getElementById('admin-lista-disputas');
        if (!lista) return;

        if (!disputas) {
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                disputas = data.dashboard.disputasRecentes;
            }
        }

        if (!disputas || disputas.length === 0) {
            lista.innerHTML = '<p>Nenhuma disputa recente.</p>';
            return;
        }

        lista.innerHTML = disputas.map(d => {
            const pagamento = d.pagamentoId;
            const criador = d.criadorId;
            const statusBadge = {
                'aberta': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aberta</span>',
                'em_analise': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Em Análise</span>',
                'resolvida_cliente': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida</span>',
                'resolvida_profissional': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida</span>'
            }[d.status] || '';

            return `
                <div class="admin-disputa-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <strong>Disputa #${d._id.toString().substring(0, 8)}</strong>
                            <p style="margin: 5px 0; color: var(--text-secondary);">
                                Criada por: ${criador?.nome || 'Usuário'} • 
                                Pagamento: R$ ${pagamento?.valor?.toFixed(2) || '0.00'}
                            </p>
                            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${d.tipo.replace(/_/g, ' ')}</p>
                            <p style="margin: 5px 0;"><strong>Motivo:</strong> ${d.motivo.substring(0, 100)}${d.motivo.length > 100 ? '...' : ''}</p>
                            ${d.status === 'aberta' || d.status === 'em_analise' ? `
                                <button class="btn-resolver-disputa" data-disputa-id="${d._id}" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                                    <i class="fas fa-gavel"></i> Resolver Disputa
                                </button>
                            ` : ''}
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');

        // Adiciona listeners para resolver disputas
        document.querySelectorAll('.btn-resolver-disputa').forEach(btn => {
            btn.addEventListener('click', () => {
                const disputaId = btn.dataset.disputaId;
                abrirModalResolverDisputa(disputaId);
            });
        });
    }

    function carregarAdminFinanceiro(stats) {
        const resumo = document.getElementById('admin-resumo-financeiro');
        if (!resumo || !stats) return;

        resumo.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Receita Total do Mês</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #28a745; margin: 0;">R$ ${parseFloat(stats.receitaMes).toFixed(2)}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Receita Total do Ano</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #007bff; margin: 0;">R$ ${parseFloat(stats.receitaAno).toFixed(2)}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Pagamentos Liberados</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #28a745; margin: 0;">${stats.pagamentosLiberados}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Taxa Média</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #ffc107; margin: 0;">5%</p>
                </div>
            </div>
        `;
    }

    async function abrirModalResolverDisputa(disputaId) {
        const resolucao = prompt('Digite a resolução da disputa:');
        if (!resolucao) return;

        const favoravelA = confirm('A resolução é favorável ao CLIENTE? (OK = Cliente, Cancelar = Profissional)') ? 'cliente' : 'profissional';

        try {
            const response = await fetch(`/api/disputas/${disputaId}/resolver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resolucao, favoravelA })
            });

            const data = await response.json();
            
            if (data.success) {
                alert('Disputa resolvida com sucesso!');
                await carregarDashboardAdmin();
            } else {
                alert(data.message || 'Erro ao resolver disputa.');
            }
        } catch (error) {
            console.error('Erro ao resolver disputa:', error);
            alert('Erro ao resolver disputa.');
        }
    }

    // Adicionar botão de dashboard admin (apenas para admins)
    // Nota: Em produção, você deve verificar se o usuário é admin no backend
    // Por enquanto, vamos adicionar um botão que só aparece se o usuário tiver permissão
    const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
    // Só tenta carregar /api/usuario/me se houver token (usuário logado)
    if (acoesRapidas && !document.getElementById('btn-dashboard-admin') && token) {
        // Verifica se é admin (em produção, isso viria do backend)
        fetch('/api/usuario/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).then(userData => {
            if (userData.isAdmin) {
                const btnAdmin = document.createElement('button');
                btnAdmin.id = 'btn-dashboard-admin';
                btnAdmin.className = 'btn-acao-lateral';
                btnAdmin.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                btnAdmin.style.color = 'white';
                btnAdmin.innerHTML = '<i class="fas fa-chart-line"></i> Dashboard Admin';
                acoesRapidas.appendChild(btnAdmin);
                
                btnAdmin.addEventListener('click', async () => {
                    await carregarDashboardAdmin();
                    modalDashboardAdmin?.classList.remove('hidden');
                });
            }
        }).catch(() => {
            // Se não conseguir verificar, não adiciona o botão
        });
    }
});

