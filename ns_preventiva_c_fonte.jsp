








<script>
	var contextPath = "/contratadaweb";
</script>











<html>
    <head>
        <link href="/contratadaweb/condis/templates/azul/css/formata.css" rel="stylesheet" type="text/css">
        <script language="JavaScript" src="/contratadaweb/biblio/Js/Key.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/ArrayUtil.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/Prototype.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/browserType.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/Delegate.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/EventManager.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/MCFormMapping-2.0.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/AutoFormMap.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/MCAjax.js"></script>
        <script>
	/**
	 * @author e004596
	 * @since 27/02/2008
	 */
	Servidor = 
	{
		// Desenvolvimento
		_ip : "http://192.168.122.110/",
		// Desenvolvimento
		_ip2 : "http://10.2.130.72:8280/",
		getSessionId : function(){
			return "74D45C4E8736A011926A1A52B0DDA3C4.PLNJBBHEGDIS08";
		},	
		Configuracao : 
		{
			getURL : function()
			{
				return Servidor._ip + "WebIntegracaoJava/";
			},
			
			getURLRelatorio : function()
			{
				return Servidor._ip + "WebRelatorio/";
			},
			
			getURLApropriacao : function()
			{
				return Servidor._ip + "WebApropriacao/";
			}, 
			getURLApropriacaoPropria : function()
			{
				return Servidor._ip + "WebApropriacaoPropria/";
			},
			getURLpdaCondisconsulta : function()
			{
				return Servidor._ip + "WebConsultasCondis/";
			},		
			getURLRaiz : function()
			{
				return Servidor._ip;
			},			
			getURLGestor : function()
			{
				return Servidor._ip2 + "gestorservicos/pages/gestor/gestor.jsf";
			}
		}
	}
	ServidorCONDIS = 
	{
	  // Desenvolvimento
	  _ip : "/contratadaweb",
	
		Configuracao : 
		{
			getURL : function()
			{
				return ServidorCONDIS._ip;
			}
		}
	}
	ServidorPM = 
	{
	  // Desenvolvimento
	  _ip : "http://192.168.122.120/",

		Configuracao : 
		{
			getURL : function()
			{
				return ServidorPM._ip + "gdispm/";
			}
		}
	}	

</script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/IntegracaoJava.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/Util.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/StringUtil.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/NumberUtil.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/DataUtil.js"></script>
        <script language="JavaScript" src="../services/ManutencaoService.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/calendar.js"></script>
        <script language="JavaScript" src="/contratadaweb/biblio/Js/somentenumero.js"></script>
        
        <!-- Arquivo armazena objetos javascript para a construção da lista de servicos -->
        <script language="JavaScript" src="/contratadaweb/biblio/Js/Servico_preventivo_manut.js"></script>
        
        
        <script language="JavaScript">
	        
            window.resizeTo(screen.availWidth, screen.availHeight);
            var mcAjax;
            var mapFrmRC;
            var hashMaterial = {};
            var hashCodMaterial = {};
            var servicos = new ListaServicos();
            var arrTipoEquipe = new Array();
            var arrPrioridade = new Array();
            
            function abrirJan(endereco,nomejan,atributos){
                window.open(endereco,nomejan,atributos)
            }
            
            EventManager.addListener(window, {onload : function(){
                    Page_Onload();
                }});





            
            function Page_Onload(){
                mcAjax = new MCAjax();
                mapFrmRC = autoFormMap.getMap("dados");
                mapFrmRC.changeFocusOnEnter = false;
                mapFrmRC.groupEffect =  false;
                mapFrmRC.setValue("malhas", "DL");
                mapFrmRC.setValue("todasMalhas", "CL;CO;DC;DL;DM;DN;DO;DS;DT;EN;EP;IQ;MK;OM;ON;RC;RL;RN;SD;TE;TI;TT");
                mostraTermografia($("tipo_inspecao").value);
                
                $('inserir').disabled = false;
                EventManager.addListener(servicos,
                {
                    onAddField : function(lst, field)
                    {
                        mapFrmRC.registerField(field);
                    }
                });
                EventManager.addListener($("BotaoEquipamento"), {onclick : function()
                    {
                        Enter($("num_disp").name, 13);
                    }});
                EventManager.addListener($("btoKitServicos"), {onclick : function()
                    {
                        janelaKitServ = window.open("inclui_kit_servico_preventivo.jsp?usuario=e252135", 
                                "JanelaCondisKitServicoCorretivo", "toollbar=0,width=500,height=90,scrolling=auto,scrollbars=yes,resizable=no");
                    }});
                EventManager.addListener($("BotaoIdentificador"), {onclick : function()
                    {
                        PesquisaInstalacao();
                    }});	
                EventManager.addListener($("BotaoEndereco"), {onclick : function()
                    {
                        abrirJan('../services/selecionaendereco.jsp?TelaOrigem=NSMP','BuscaEnderecoCCS',
                                'toollbar=0,width=660,height=350,left=0,top=0,scrolling=auto,scrollbars=yes');
                    }});	
                EventManager.addListener($("infComplementares"), {onkeyup : function()
                    {
                        return TamanhoMaximo2($("infComplementares"), 255);
                    }});
                EventManager.addListener($("infComplementares"), {onkeydown : function()
                    {
                        return TamanhoMaximo($("infComplementares"), 255);
                    }});
                EventManager.addListener($("obsServico"), {onkeydown : function()
                    {
                        return TamanhoMaximo($("obsServico"), 255);
                    }});
                EventManager.addListener($("obsServico"), {onkeyup : function()
                    {
                        return TamanhoMaximo2($("obsServico"), 255);
                    }});
                EventManager.addListener($("qtdePoste"), {onkeyup : function()
                    {
                        return mudaQtdPoste($("qtdePoste"));
                    }});
                EventManager.addListener($("qtdePoste"), {onblur : function()
                    {
                        verificaHistorico($("latitude").value, $("longitude").value, mapFrmRC.getValue("qtdePoste"));
                        return mudaQtdPoste($("qtdePoste"));
                    }});
                EventManager.addListener($("antesDepois"), {onblur : function()
                    {
            
                            if(mapFrmRC.getValue("qtdePoste").length > 0){
                                $("antesDepois").disabled = false;
                                $("antesDepois").className = "comboEditavel";
                            }
            
                    }});
    			
    			EventManager.addListener($("antesDepois"), {onchange : function()
    			{
    				verificaHistorico($("latitude").value, $("longitude").value, mapFrmRC.getValue("qtdePoste"));
    				mudaAntesDepois($("antesDepois").options[$("antesDepois").selectedIndex]);
    			}});
    			
    			EventManager.addListener($("latitudeReal"), {onblur : function()
    			{
    				if(mapFrmRC.getValue("qtdePoste").length > 0 && mapFrmRC.getValue("qtdePoste") > 0 && "" == ""){
    					$("latitudeReal").readOnly = false;
    					$("latitudeReal").className = "editavel";
    				}
    			}});
    			
    			EventManager.addListener($("longitudeReal"), {onblur : function()
    			{
    				if(mapFrmRC.getValue("qtdePoste").length > 0 && mapFrmRC.getValue("qtdePoste") > 0 && "" == ""){
    					$("longitudeReal").readOnly = false;
    					$("longitudeReal").className = "editavel";
    				}
    			}});
    			
    			EventManager.addListener($("selCodServico"), {onchange : function()
    			{
    				return selecionaDescServico();
    			}});
    			
    			EventManager.addListener($("selDescServico"), {onchange : function()
    			{
    				return selecionaCodServico();
    			}});

    			EventManager.addListener($("btnTrafo"), {onclick : function()
        			{
        				abrirJan('../services/selecionatrafo.jsp?TelaOrigem=NSMP&malhas=' 
        	    				+ StringUtil.trim(mapFrmRC.getValue("malhas")),'Equipamento',
        	    				'toollbar=0,width=660,height=350,left=0,top=0,scrolling=auto,scrollbars=yes');
        			}});
    					
    			
    			EventManager.addListener($("btoServicos"), {onclick : function()
    			{
    				// Versão antiga, quandos os pontos e US eram definidos nesta tela. #versao_antiga
    				//var pontos = (mapFrmRC.getValue('txtPontos') == "undefined" ? "" : mapFrmRC.getValue('txtPontos'));
    				//var us = (mapFrmRC.getValue('txtUs') == "undefined" ? "" : mapFrmRC.getValue('txtUs'));
    				
    				var pontos = "";
    				var us = "";
    				var txtComp = ($('componente').selectedIndex == -1 ? "" : $('componente').options[$('componente').selectedIndex].text);
    				var id = ($('selCodServico').selectedIndex == -1 ? "" : $('selCodServico').options[$('selCodServico').selectedIndex].text);
    				var delta = "";
    				var termo = "";
    				var latiIniSel = "";
    				var longIniSel = "";
    				var latiFimSel = "";
    				var longFimSel = "";
    				if(mapFrmRC.getValue('hdnTipo_inspecao') == ""){
    					alert("Tipo de inspeção inválida.");
    					$('tipo_inspecao').focus();
    					return false;
    				}else if(mapFrmRC.getValue('hdnTipo_inspecao') == 3){
    					delta = mapFrmRC.getValue('tDelta');
    					termo = mapFrmRC.getValue('tTermografia');
    				}
    				if(mapFrmRC.getValue('selCodServico') == 193 || mapFrmRC.getValue('selCodServico') == 194 || mapFrmRC.getValue('selCodServico') == 320 || mapFrmRC.getValue('selCodServico') == 2220 || mapFrmRC.getValue('selCodServico') == 2221 || mapFrmRC.getValue('selCodServico') == 2231 || mapFrmRC.getValue('selCodServico') == 2234){
    				    latiIniSel = mapFrmRC.getValue('insLatiIniSel');
                        longIniSel = mapFrmRC.getValue('insLongIniSel');
                        latiFimSel = mapFrmRC.getValue('insLatiFimSel');
                        longFimSel = mapFrmRC.getValue('insLongFimSel');
    					if (latiIniSel == "" || longIniSel == "" || latiFimSel == "" || longFimSel == "") {
    						alert("As coordenadas inicial e final são obrigatórias");
    						$('insLatiIniSel').focus();
    						return false;
    					}
                    }
    				addServicos(0, mapFrmRC.getValue('selDescServico'), $('selDescServico').options[$('selDescServico').selectedIndex].text, mapFrmRC.getValue('txtQtdeServ'), 1, mapFrmRC.getValue('componente'), txtComp, pontos, us, 'S', mapFrmRC.getValue('prioridade'), $('prioridade').options[$('prioridade').selectedIndex].text, mapFrmRC.getValue('obsServico'), 'IN', mapFrmRC.getValue('equipe'), $('equipe').options[$('equipe').selectedIndex].text, 'PE', mapFrmRC.getValue('hdnTipo_inspecao'), delta, termo, latiIniSel, longIniSel, latiFimSel, longFimSel, 0, 'N');
    			}});

    		    EventManager.addListener($("btoLimpar"), {onclick : function()
   		        {
   		    	
    		    	window.location = contextPath + "/condis/concod/manutencao/solicitacao/ns_preventiva.jsp";
   		    	
   		        }});

    		    EventManager.addListener($("btoVoltar"), {onclick : function()
   		        {	
   		        	if((!$("idnsmanut") || $("idnsmanut").value == "")){
   		        		 self.location = contextPath + "/MNControler/consulta_preventiva";

   		            }else{
   		            	window.close();
   		            }
   		        	
   		        }});
    			
                EventManager.addListener($("tipo_inspecao"), {onchange : function()
                    {
                        $("hdnTipo_inspecao").value = mapFrmRC.getValue("tipo_inspecao");
                        mostraTermografia(mapFrmRC.getValue("tipo_inspecao"));
                    }});
                
                EventManager.addListener($("matInspetor"), {onblur : function()
                    {
                        return buscaInspetor(mapFrmRC.getValue("matInspetor"));
                    }});
                
                EventManager.addListener($("rcOrigem"), {onclick : function()
                    {
            
                        }});
            
                    $("identificador").focus();
            	
          }
/* FIM DO METODO ONLOAD */






            
            function findServico(codigo, poste){
    			return servicos.findByCodServico(codigo, poste);
    		}

    		function addServicos(idServ, codServ, descServ, qtd, poste, codComp, descComp, pontos, us, apropQuant, codPrior, descPrior, obs, acao, codEquipe, descEquipe, situacao, tipoInsp, delta, termo, latiIni, longIni, latiFim, longFim, idkitservico, indKitMaterial){
    			poste = 1;

    			if(tipoInsp == ""){
    				alert("Escolha o tipo de inspeção.");
    				$("tipo_inspecao").focus();
    				return false;
    			}
    			
    			if(codServ == ""){
    				alert("Escolha o serviço");
    				$("selDescServico").focus();
    				return false;
    			}else if(codComp == ""){
    				alert("Escolha um componente.");
    				$("componente").focus();
    				return false;
    			}else if(qtd == ""){
    				alert("Preencha a quantidade de serviços.");
    				$("txtQtdeServ").focus();
    				return false;
    			}else if(qtd != "" && qtd <= 0){
    				alert("A quantidade de serviços deve ser maior que 0.");
    				$("txtQtdeServ").focus();
    				return false;
    			}else if(codEquipe == ""){
    				alert("Escolha uma equipe.");
    				$("equipe").focus();
    				return false;
    			}else if(codPrior == ""){
    				alert("Escolha uma prioridade.");
    				$("prioridade").focus();
    				return false;
    			}else if (document.all("servicoItemSel") != undefined){
    				if (typeof(document.all("servicoItemSel").length) != "undefined"){
    					for (i=0; i < document.all("servicoItemSel").length; i++){
    						if(codServ == document.all("servicoItemSel")[i].value){
    							alert("Serviço '" + descServ + "' não incluído.\nJá existe serviço do mesmo tipo.");
    							return false;
    							break;
    						}
    					}
    				}else{
    					if (codServ == document.all("servicoItemSel").value){
    						alert("Serviço '" + descServ + "' não incluído.\nJá existe serviço do mesmo tipo.");
    						return false;
    					}
    				}
    			}

    			if(tipoInsp == "3"){
    				if(termo == ""){
    					alert("Termograma inválido.");
    					$("tTermografia").focus();
    					return false;
    				}else if(delta == ""){
    					alert("Delta T inválido.");
    					$("tDelta").focus();
    					return false;
    				}
    			}
    			
    			if(us == undefined){
    				us = "";
    			}
    			
    			if(pontos == undefined){
    				pontos = "";
    			}

    			servicos.add(new Servico(idServ, codServ, descServ, qtd, poste, codComp, descComp, pontos, us, apropQuant, codPrior, descPrior, obs, acao, codEquipe, descEquipe, situacao, tipoInsp, delta, termo, latiIni, longIni, latiFim, longFim, idkitservico, indKitMaterial));
    			
    			if( (us == null || us == "") && (pontos == null || pontos == "")){				
    				document.getElementById('us_serv_pos_apropriacao').style.display = 'none';				
    				var usTds = document.getElementsByName('usItemSel');
    				for (var i = 0; i < usTds.length; i++){
    					usTds[i].parentNode.style.display = 'none';
    				}
    				
    				document.getElementById('pontos_serv_pos_apropriacao').style.display = 'none';
    				var pontosTds = document.getElementsByName('pontosItemSel');
       				for (var i = 0; i < pontosTds.length; i++){
    					pontosTds[i].parentNode.style.display = 'none';
    				}			
    			}

    			$("selDescServico").selectedIndex = 0;
    		
    			$("txtQtdeServ").value = "";
    			$("obsServico").value = "";
    			$("txtPontos").value = "";
    			$("txtUS").value = "";
    			$("componente").selectedIndex = 0;
    			$("componente").length = 1;
    			$("prioridade").selectedIndex = 0;
    			$("equipe").selectedIndex = 0;
    			$("tdServicosSel").style.display = "block";
    			$("tipo_inspecao").disabled = true;
    			$("tipo_inspecao").className = "comboNaoEditavel";
    			if(mapFrmRC.getValue("hdnTipo_inspecao") == "3"){
    				$("tDelta"). value = "";
    				$("tTermografia"). value = "";
    			}
    			if(mapFrmRC.getValue('selCodServico') == 193 || mapFrmRC.getValue('selCodServico') == 194 || mapFrmRC.getValue('selCodServico') == 320 || mapFrmRC.getValue('selCodServico') == 2220 || mapFrmRC.getValue('selCodServico') == 2221 || mapFrmRC.getValue('selCodServico') == 2231 || mapFrmRC.getValue('selCodServico') == 2234){
    				mapFrmRC.clearField($('insLatiIniSel'));
    				mapFrmRC.clearField($('insLongIniSel'));
    				mapFrmRC.clearField($('insLatiFimSel'));
    				mapFrmRC.clearField($('insLongFimSel'));
    			}			
    			$("selCodServico").selectedIndex = 0;
    		}
    		
    		function addKitServico(idKitServico){
    			if(mapFrmRC.getValue("hdnTipo_inspecao") == ""){
    				alert("Escolha o tipo de inspeção.");
    				$("tipo_inspecao").focus();
    				return false;
    			}
    			
    			ManutencaoService.consultas.tiposervico.tipoServicoPorKit({"idkitservico":idKitServico, "poste":1},
    			{
    				onSuccess : Delegate(this, function(arg, idKitServico)
    				{
    					if (arg.rows.length > 0){
    						for (var i = 0; i < arg.rows.length; i ++){
    							addServicos(0, arg.rows[i].idtiposervico, arg.rows[i].descServ, arg.rows[i].quantidade, 1, arg.rows[i].idcomponente, arg.rows[i].descComp, arg.rows[i].pontos, arg.rows[i].us, 'S', arg.rows[i].idtipoprioridade, arg.rows[i].descPrior, '', 'IN', arg.rows[i].idtipoequipe, arg.rows[i].descEquipe, 'PE', mapFrmRC.getValue("hdnTipo_inspecao"), '0', '0', '', '', '', '', arg.rows[i].idkitservico, arg.rows[i].indkitmaterial);
    						}	
    					}
    					document.getElementById('us_serv_pos_apropriacao').style.display = 'none';				
    					var usTds = document.getElementsByName('usItemSel');
    					for (var i = 0; i < usTds.length; i++){
    						usTds[i].parentNode.style.display = 'none';
    					}
    				
    					document.getElementById('pontos_serv_pos_apropriacao').style.display = 'none';
    					var pontosTds = document.getElementsByName('pontosItemSel');
    					for (var i = 0; i < pontosTds.length; i++){
    						pontosTds[i].parentNode.style.display = 'none';
    					}		
    				})
    			});
    		}

    		function findObject(obj){
    			if(document.all(obj) == null){
    				return false;
    			}else{
    				return true;
    			}
    		}

    		function addMaterial(idMaterial, servico, codigo, desc, qtd, codServ, poste, idTabela, acao, kit){
    			if(kit == 'N'){
    				for(i = 0; servicos.itens.length; i++){
    					if(servicos.itens[i].codServ == servico.codServ && servicos.itens[i].poste == servico.poste){
    						$("img" + idTabela).src = "/contratadaweb/imagens/move_up.gif";
    						document.all("tr_" + idTabela).style.display = "block";
    						document.all(idTabela).style.display = "block";
    						servicos.itens[i].materiais.add(new Material(idMaterial, servico.idServ, codigo, desc, qtd, codServ, poste, idTabela, acao, kit));
    						break;
    					}
    				}
    			}
    		}


    		
            function checaDados(){
                
            	var resultadoValidacaoTermo = servicos.validarDadosTermografia();

            	if(resultadoValidacaoTermo !== "dadosvalidos"){
                	alert(resultadoValidacaoTermo);
                	return false;
                }
                
            
                    if(mapFrmRC.getValue("identificador") == "" && mapFrmRC.getValue("num_disp") == "" && mapFrmRC.getValue("trafo_pesq") == ""){
                        alert("Um dos campos abaixo deve ser informado:\\n    -Ponto de instalação.\\n    -Equipamento.\\n    -Transformador.");
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("identificador") != "" && mapFrmRC.getValue("identificador").length < 10){
                        alert("Instalação inválida.");
                        $("identificador").focus();
                        $("inserir").disabled = false;
                        return false
                    }
            
                    if(mapFrmRC.getValue("subalim") == ""){
                        alert("Subestação - Alimentador inválido.");
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("endereco") == ""){
                        alert("Endereço inválido.");
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("numEndereco") == ""){
                        alert("Número do endereço inválido.");
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("regiao") == ""){
                        alert("Região inválida.");
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("local") == ""){
                        alert("Local inválido.");
                        $("inserir").disabled = false;
                        return false;
                    }
            
                    if((mapFrmRC.getValue("trafo_pesq") != "") || (mapFrmRC.getValue("identificador") != "")){
                        if(mapFrmRC.getValue("trafo") == ""){
                            alert("Transformador inválido.");
                            $("inserir").disabled = false;
                            return false;
                        }
                    }
            
                    if(mapFrmRC.getValue("qtdePoste") != "" && mapFrmRC.getValue("qtdePoste") > 0){
                        if($("antesDepois").options[$("antesDepois").selectedIndex].value == ""){
                            alert("Preencha o campo antes/depois.");
                            $("antesDepois").focus();
                            $("inserir").disabled = false;
                            return false;
                        }
                    }
                    if(mapFrmRC.getValue("latitudeReal").length < 8){
                        alert("Latitude Real inválida.");
                        $("latitudeReal").focus();
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("longitudeReal").length < 8){
                        alert("Longitude Real inválida.");
                        $("longitudeReal").focus();
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("hdntipoArea") == ""){
                        alert("Tipo de área inválido.");
                        return false;
                    }
                    if(mapFrmRC.getValue("numDispFonte") == "" && (mapFrmRC.getValue("tag_fonte_alm") == "" || mapFrmRC.getValue("tag_fonte_alm") == "N")){
                        alert("Chave fonte inválida.");
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("tipo_inspecao") == ""){
                        alert("Preencha o Tipo de Inspeção.");
                        if(!$("tipo_inspecao").disabled){
                            $("tipo_inspecao").focus();
                        }
                        $("inserir").disabled = false;
                        return false;
                    }
                    if(mapFrmRC.getValue("nomeInspetor") == ""){
                        alert("Informe o inspetor.");
                        $("matInspetor").focus();
                        $("inserir").disabled = false;
                        return false;
                    }
                    //Verificar campos das coordenadas
                    if (document.getElementById("inserir").value == "Atualizar") {
	                    var items = document.getElementsByName('servicoItemSel');
	                    var latini = document.getElementsByName('latiIniSel');
	                    var lonini = document.getElementsByName('longIniSel');
	                    var latfim = document.getElementsByName('latiFimSel');
	                    var lonfim = document.getElementsByName('longFimSel');
	                    for (i = 0, j = 0; i < items.length; i++) {
	                    	if (items[i].value == 193 || items[i].value == 194 || items[i].value == 320 || items[i].value == 2220 || items[i].value == 2221 || items[i].value == 2231 || items[i].value == 2234) {
	                    		latiIniSel = latini[j].value;
	                        	longIniSel = lonini[j].value;
	                        	latiFimSel = latfim[j].value;
	                        	longFimSel = lonfim[j].value;
	                        	j++; /* itera as listas de coordenadas */

	    						if (latiIniSel == "" || longIniSel == "" || latiFimSel == "" || longFimSel == "" ||
	    								latiIniSel == "-  .      " || longIniSel == "-  .      " || latiFimSel == "-  .      " || longFimSel == "-  .      "  ) {
	    							alert("As coordenadas inicial e final são obrigatórias");
	    							$("inserir").disabled = false;
	    							return false;
	    						}
	    	    			}
	                    }
                    }
 					
                    if($("servicoItemSel") == undefined){
                        alert("Informe no mínimo um serviço.");
                        $("selDescServico").focus();
                        $("inserir").disabled = false;
                        return false;
                    }else if(document.all("servicoItemSel").length == undefined){
                        if(mapFrmRC.getValue("qtdItemSel") == ""){
                            alert("Preencha a quantidade do serviço.");
                            $("qtdItemSel").focus();
                            $("inserir").disabled = false;
                            return false;
                        }else{
                            if(isNaN(mapFrmRC.getValue("qtdItemSel"))){
                                alert("Campo quantidade deve ser numérico.");
                                $("qtdItemSel").select();
                                $("inserir").disabled = false;
                                return false;
                            }else if(mapFrmRC.getValue("qtdItemSel") < 1){
                                alert("Preencha uma quantidade válida.");
                                $("qtdItemSel").focus();
                                $("qtdItemSel").select();
                                $("inserir").disabled = false;
                                return false;
                            }
                        }
                    }else if(document.all("servicoItemSel").length != undefined){
                        for (i = 0; i < document.all("servicoItemSel").length; i++){
                            if(document.all("qtdItemSel")[i].value == ""){
                            	
                                alert("Preencha uma quantidade válida.");
                                document.all("qtdItemSel")[i].focus();
                                document.all("qtdItemSel")[i].select();
                                $("inserir").disabled = false;
                                return false;
                            }else{
                                if(isNaN(document.all("qtdItemSel")[i].value)){
                                    alert("Campo quantidade deve ser numérico.");
                                    document.all("qtdItemSel")[i].select();
                                    $("inserir").disabled = false;
                                    return false;
                                }else if(document.all("qtdItemSel")[i].value < 1){
                                    alert("Preencha uma quantidade válida.");
                                    document.all("qtdItemSel")[i].focus();
                                    document.all("qtdItemSel")[i].select();
                                    $("inserir").disabled = false;
                                    return false;
                                }
                            }
                        }
                    }
                    if(document.all("codMatItemSel") != undefined){
                        if(document.all("codMatItemSel").length == undefined){
                            if(mapFrmRC.getValue("qtdMatItemSel") == ""){
                                alert("Preencha a quantidade do material.");
                                $("qtdMatItemSel").focus();
                                $("inserir").disabled = false;
                                return false;
                            }else{
                                if(isNaN(mapFrmRC.getValue("qtdMatItemSel"))){
                                    alert("Campo quantidade deve ser numérico.");
                                    $("qtdMatItemSel").select();
                                    $("inserir").disabled = false;
                                    return false;
                                }
                            }
                        }else if(document.all("codMatItemSel").length != undefined){
                            for (i = 0; i < document.all("codMatItemSel").length; i++){
                                if(document.all("qtdMatItemSel")[i].value == ""){
                                    alert("Preencha uma quantidade válida.");
                                    document.all("qtdMatItemSel")[i].focus();
                                    document.all("qtdMatItemSel")[i].select();
                                    $("inserir").disabled = false;
                                    return false;
                                }else{
                                    if(isNaN(document.all("qtdMatItemSel")[i].value)){
                                        alert("Campo quantidade deve ser numérico.");
                                        document.all("qtdMatItemSel")[i].select();
                                        $("inserir").disabled = false;
                                        return false;
                                    }
                                }
                            }
                        }
                    }
            
            		$("IncluirNota").value = "incluir";
            
                    return true;
       }
/* fim do metodo checaDados */

				function habilitaBtInserir() {
	    			$("inserir").disabled = false;
	    		}
                
                function Enter(){
                    if(mapFrmRC.getValue("num_disp") == ""){
                        alert("Preencha o número do equipamento.");
                        $("num_disp").focus();
                        return false;
                    }else{
                        IntegracaoJava.consultas.equipamentoPorMalhas({numero:StringUtil.trim(mapFrmRC.getValue("num_disp")), malhas:StringUtil.trim(mapFrmRC.getValue("todasMalhas"))},
                        {
                            onSuccess : Delegate(this, function(rows)
                            {	
                                if (rows.length == 0){
                                    alert("Equipamento não encontrado.");
                                    $("num_disp").value = "";
                                    $("num_disp").focus();
                                }else if(rows.length == 1){
                                    ManutencaoService.consultas.local.dadosLocal({"local":rows[0].local},{
                                        onSuccess : Delegate(this, function(arg2)
                                        {
                                            if (arg2.rows.length > 0){

                                            	if(mapFrmRC.getValue("malhas").indexOf(arg2.rows[0].superin) == -1){
                                                    alert("Equipamento está em uma malha onde não possui permissão para acesso. Favor verificar.");
                                                    $("num_disp").focus();                                    
                                                }else{                      
	                                                var arrayRetorno = rows[0];
	                                                arrayRetorno.subalim = (arrayRetorno.subEsta + "    ").substring(0,4) + ("    " + arrayRetorno.alimenta).substring(4,7);
	                                                arrayRetorno.numEndereco = arrayRetorno.numeroEndereco;
	                                                arrayRetorno.endereco = StringUtil.trim(arrayRetorno.endereco);
	                                                arrayRetorno.trafo_pesq = "";
	                                                arrayRetorno.identificador = "";
	                                                arrayRetorno.cod_disp = arrayRetorno.tipo;
	                                                mudaTipoTrecho(arrayRetorno.tipoTrecho);
	                                                arrayRetorno.consumoEqu = arrayRetorno.consumo;
	                                                arrayRetorno.local = arg2.rows[0].local + " - " + arg2.rows[0].descricao;
	                                                $("trafo_pesq").disabled = true;
	                                                $("trafo_pesq").value = "";
	                                                $("btnTrafo").disabled = true;
	                                                $("identificador").disabled = true;
	                                                $("identificador").value = "";
	                                                $("identificador").className = "naoEditavel";
	                                                $("BotaoIdentificador").disabled = true;
	                                                $("BotaoEndereco").disabled = true;
	                                                verificaHistorico(arrayRetorno.latitude, arrayRetorno.longitude, mapFrmRC.getValue("qtdePoste"));
	                                                arrayRetorno.latitudeReal = trataCoordenada(arrayRetorno.latitude.toString());
	                                                arrayRetorno.longitudeReal = trataCoordenada(arrayRetorno.longitude.toString());
	                                                arrayRetorno.latitude = trataCoordenada(arrayRetorno.latitude.toString());
	                                                arrayRetorno.longitude = trataCoordenada(arrayRetorno.longitude.toString());
	                                                $("qtdePoste").readOnly = false;
	                                                $("qtdePoste").className = "editavel";
	                                                mapFrmRC.setData(arrayRetorno);
	                                                buscaChaveFonte(mapFrmRC.getValue("num_disp"), null, null, arg2.rows[0].local);
	                                                document.getElementById("malhaEqu").innerHTML = arg2.rows[0].superin ;
                                                }
                                            }else{
                                                alert("Local da instalação não encontrado.");
                                            }
                                        })
                                    });
                                }else if(rows.length > 1){
                                    SelecionaEqptos(StringUtil.trim(mapFrmRC.getValue("num_disp")), $("malhas").value);
                                }
                            })
                        });
                    }
                }
                function SelecionaEqptos(eqpto, malhas){
                    window.open("../services/selecionaequipamentopormalha.jsp?Malhas="+malhas+"&Eqpto=" + eqpto, "JanelaCondis", "Scrollbars=no; toolbar=no; resize=no");
                }
                function habilitaBtnCad(){
                    $("inserir").disabled = false;
                }
        		function desabilitaBtnCad(){
        			$("inserir").disabled = true;
        		}
                function limpaCampos(){
                    mapFrmRC.setValue("local", "");
                    mapFrmRC.setValue("regiao", "");
                    mapFrmRC.setValue("endereco", "");
                    mapFrmRC.setValue("numEndereco", "");
                    mapFrmRC.setValue("compl", "");
                    mapFrmRC.setValue("ddd", "");
                    mapFrmRC.setValue("telefone", "");
                    mapFrmRC.setValue("subalim", "");
                    mapFrmRC.setValue("trafo", "");
                    mapFrmRC.setValue("carregamento", "");
                    mapFrmRC.setValue("latitude", "_");
                    mapFrmRC.setValue("longitude", "_");
                    mapFrmRC.setValue("latitudeReal", "_");
                    mapFrmRC.setValue("longitudeReal", "_");
                    mapFrmRC.setValue("numDispFonte", " ");
                    mapFrmRC.setValue("codDispFonte", " ");
                    mapFrmRC.setValue("localChaveFonte", "");
                    mapFrmRC.setValue("consumoChaveFonte", "");
                    mapFrmRC.setValue("referencia", " ");
                    mapFrmRC.setValue("compl", " ");
                    mapFrmRC.setValue("bairro", " ");
                    mudaTipoTrecho("");
                    mapFrmRC.setValue("cod_disp", "");
                    mapFrmRC.setValue("trafo_pesq", "");
                    mapFrmRC.setValue("num_disp", "");
                    $("btnHistorico").style.display = "none";
                }
                function limpaArrayRetorno(arrayRetorno){
                    arrayRetorno.local = "";
                    arrayRetorno.regiao = "";
                    arrayRetorno.local = "";
                    arrayRetorno.endereco = "";
                    arrayRetorno.numEndereco = "";
                    arrayRetorno.compl = "";
                    arrayRetorno.codClasse = ""; 
                    arrayRetorno.ddd = "";
                    arrayRetorno.telefone = "";
                    arrayRetorno.subClasse = "";
                    arrayRetorno.subalim = "";
                    arrayRetorno.trafo = "";
                    arrayRetorno.carregamento = "";
                    arrayRetorno.latitude = "_";
                    arrayRetorno.longitude = "_";
                    arrayRetorno.latitudeReal = "_";
                    arrayRetorno.longitudeReal = "_";
                    arrayRetorno.numDispFonte = "";
                    arrayRetorno.codDispFonte = " ";
                    arrayRetorno.localChaveFonte = "";
                    arrayRetorno.consumoChaveFonte = "";
                    arrayRetorno.referencia = " ";
                    arrayRetorno.compl = " ";
                    arrayRetorno.bairro = " ";
                    mudaTipoTrecho("");
                    arrayRetorno.cod_disp = "";
                    arrayRetorno.trafo_pesq = "";
                    arrayRetorno.num_disp = "";
                    $("btnHistorico").style.display = "none";
                    return arrayRetorno;
                }
                
                function PesquisaInstalacao(){
                    if(mapFrmRC.getValue("identificador") == ""){
                        alert("Informe o P. de Instalação");
                        $("identificador").focus();
                        return false;
                    }else{
                        if(mapFrmRC.getValue("identificador").length < 10){
                            alert("Ponto de instalação inválido.");
                            $("identificador").focus();
                            return false;
                        }
                        var identificador = StringUtil.trim(mapFrmRC.getValue("identificador"));
                        IntegracaoJava.consultas.parceiroNegocioPorInstalacao(identificador,
                        {
                            onSuccess : Delegate(this, function(rows){
                                if (rows.length > 0){
                                    ManutencaoService.consultas.local.dadosLocal({"local":rows[0].unidadeLeitura.substring(2,6)},{
                                        onSuccess : Delegate(this, function(arg2)
                                        {
                                            if (arg2.rows.length > 0){
                                                IntegracaoJava.consultas.instalacaoPorNumero(identificador,
                                                {
                                                    onSuccess : Delegate(this, function(rows2){
                                                        if(rows2.length > 0){
                                                            var arrayRetorno = rows[0];
                                                            if(mapFrmRC.getValue("malhas").indexOf(arg2.rows[0].superin, 0) == -1){
                                                                alert("Usuário sem permissão na malha do ponto de instalação.");
                                                                arrayRetorno = limpaArrayRetorno(arrayRetorno);
                                                                mapFrmRC.setData(arrayRetorno);
                                                            }else{
                                                                arrayRetorno.local = arrayRetorno.unidadeLeitura.substring(2,6);
                                                                arrayRetorno.regiao = arg2.rows[0].regiao;
                                                                arrayRetorno.local = arg2.rows[0].local + " - " + arg2.rows[0].descricao;
                                                                arrayRetorno.endereco = StringUtil.trim(arrayRetorno.nomelogradouro);
                                                                arrayRetorno.numEndereco = arrayRetorno.numero;
                                                                arrayRetorno.compl = arrayRetorno.complemento;
                                                                arrayRetorno.codClasse = arrayRetorno.classe.substring(0,2); 
                                                                arrayRetorno.ddd = arrayRetorno.telefone.substring(0,2);
                                                                arrayRetorno.telefone = arrayRetorno.telefone.substring(2,10);
                                                                arrayRetorno.subClasse = arrayRetorno.classe.substring(2,4);
                                                                arrayRetorno.subalim = (rows2[0].transformador.subestacao + "    ").substring(0,4) + ("    " + rows2[0].transformador.alimentador).substring(4,7);
                                                                arrayRetorno.trafo = rows2[0].transformador.numero + "-" + rows2[0].transformador.numeroFases + "-" + rows2[0].transformador.potencia + "-" + rows2[0].transformador.local;
                                                                arrayRetorno.carregamento = (rows2[0].transformador.demandaFaseA + rows2[0].transformador.demandaFaseB + rows2[0].transformador.demandaFaseC);
                                                                arrayRetorno.latitude = trataCoordenada(rows2[0].latitude.toString());
                                                                arrayRetorno.longitude = trataCoordenada(rows2[0].longitude.toString());
                                                                arrayRetorno.latitudeReal = trataCoordenada(rows2[0].latitude.toString());
                                                                arrayRetorno.longitudeReal = trataCoordenada(rows2[0].longitude.toString());
                                                                mudaTipoTrecho(rows2[0].transformador.tipoTrecho);
                                                                arrayRetorno.cod_disp = "";
                                                                $("trafo_pesq").disabled = true;
                                                                $("trafo_pesq").value = "";
                                                                $("btnTrafo").disabled = true;
                                                                $("num_disp").disabled = true;
                                                                $("num_disp").className = "naoEditavel";
                                                                $("num_disp").value = "";
                                                                $("BotaoEquipamento").disabled = true;
                                                                if (StringUtil.trim(arrayRetorno.numero) == "" || isNaN(arrayRetorno.numero)){
                                                                    arrayRetorno.numero = "0";
                                                                }
                                                                $("qtdePoste").readOnly = false;
                                                                $("qtdePoste").className = "editavel";
                                                                verificaHistorico(rows2[0].latitude, rows2[0].longitude, mapFrmRC.getValue("qtdePoste"));
                                                                mapFrmRC.setData(arrayRetorno);
                                                                buscaChaveFonte(rows2[0].transformador.numero, rows2[0].transformador.numeroFases, rows2[0].transformador.potencia , rows2[0].transformador.local);
                                                            }
                                                        }else{
                                                            alert("Instalação não encontrada");
                                                            mapFrmRC.setValue("identificador", "");
                                                            $("identificador").focus();
                                                            arrayRetorno = limpaArrayRetorno(arrayRetorno);
                                                            mapFrmRC.setData(arrayRetorno);
                                                        }
                                                    })
                                                });
                                            }else{
                                                alert("Local da instalação não encontrado.");
                                                limpaCampos();
                                            }
                                        })
                                    });
                                }else{
                                    alert("Instalação não encontrada");
                                    mapFrmRC.setValue("identificador", "");
                                    $("identificador").focus();
                                    limpaCampos();
                                }
                            })
                        });
                    }
                }
                
                function buscaChaveFonte(numDisp, fases, potencia, local){
                    if(fases != null && potencia != null){
                        IntegracaoJava.consultas.sequenciaRedePorTrafo(numDisp, potencia, fases, local,
                        {
                            onSuccess : Delegate(this, function(rows){
                                if(rows.length > 0){
                                    if(StringUtil.trim(rows[0].numequ) == "0"){
                                        $("numDispFonte").value = mapFrmRC.getValue("subalim");
                                        $("codDispFonte").value = "";
                                        $("localChaveFonte").value = "";
                                        $("consumoChaveFonte").value = "";
                                        $("tag_fonte_alm").value = "S";
                                    }else{
                                        IntegracaoJava.consultas.equipamentosPorLocal(StringUtil.trim(rows[0].numequ), StringUtil.trim(rows[0].local),
                                        {
                                            onSuccess : Delegate(this, function(rows2){
                                                if (rows2.length > 0){
                                                    var arrayRetorno = rows2[0];
                                                    $("numDispFonte").value = arrayRetorno.numero;
                                                    $("codDispFonte").value = arrayRetorno.tipo;
                                                    $("localChaveFonte").value = arrayRetorno.local;
                                                    $("consumoChaveFonte").value = arrayRetorno.consumo;
                                                    $("numDispFonteOri").value = arrayRetorno.numero;
                                                    $("codDispFonteOri").value = arrayRetorno.tipo;
                                                    $("localChaveFonteOri").value = arrayRetorno.local;
                                                    $("consumoChaveFonteOri").value = arrayRetorno.consumo;
                                                    $("tag_fonte_alm").value = "N";
                                                }else{
                                                    alert("Chave fonte não encontrada.");
                                                    mapFrmRC.setValue("numDispFonte", "");
                                                    mapFrmRC.setValue("codDispFonte", "");
                                                    mapFrmRC.setValue("localChaveFonte", "");
                                                    mapFrmRC.setValue("consumoChaveFonte", "");
                                                    mapFrmRC.setValue("tag_fonte_alm", "");
                                                    $("inserir").disabled = true;
                                                    return false;
                                                }
                                            })
                                        });
                                    }
                                    $("inserir").disabled = false;
                                }else{
                                    alert("Chave fonte não encontrada.");
                                    mapFrmRC.setValue("numDispFonte", "");
                                    mapFrmRC.setValue("codDispFonte", "");
                                    mapFrmRC.setValue("localChaveFonte", "");
                                    mapFrmRC.setValue("consumoChaveFonte", "");
                                    mapFrmRC.setValue("tag_fonte_alm", "");
                                    $("inserir").disabled = true;
                                }
                            }),
                            onFailure : Delegate(this, function(code, message)
                            {
                                alert(message);
                            })
                        });
                    }else{
                        IntegracaoJava.consultas.sequenciaRedePorEquipamento(numDisp, local,
                        {
                            onSuccess : Delegate(this, function(rows){
                                if(rows.length > 0){
                                    if(StringUtil.trim(rows[0].numequ) == "0"){
                                        if(mapFrmRC.getValue("qtdePoste").length > 0 && mapFrmRC.getValue("qtdePoste") > 0 && mapFrmRC.getValue("antesDepois") == "D"){
                                            $("numDispFonte").value = mapFrmRC.getValue("num_disp");
                                            $("codDispFonte").value = mapFrmRC.getValue("cod_disp");
                                            $("localChaveFonte").value = mapFrmRC.getValue("local");
                                            $("consumoChaveFonte").value = mapFrmRC.getValue("consumoEqu");
                                        }else{
                                            $("numDispFonte").value = "";
                                            $("codDispFonte").value = "";
                                            $("localChaveFonte").value = "";
                                            $("consumoChaveFonte").value = "";
                                        }
                                        $("tag_fonte_alm").value = "S";
                                    }else{
                                        IntegracaoJava.consultas.equipamentosPorLocal(StringUtil.trim(rows[0].numequ), StringUtil.trim(rows[0].local),
                                        {
                                            onSuccess : Delegate(this, function(rows2){
                                                if (rows2.length > 0){
                                                    var arrayRetorno = rows2[0];
                                                    if(mapFrmRC.getValue("qtdePoste").length > 0 && mapFrmRC.getValue("qtdePoste") > 0 && mapFrmRC.getValue("antesDepois") == "D"){
                                                        $("numDispFonte").value = mapFrmRC.getValue("num_disp");
                                                        $("codDispFonte").value = mapFrmRC.getValue("cod_disp");
                                                        $("localChaveFonte").value = mapFrmRC.getValue("local");
                                                        $("consumoChaveFonte").value = mapFrmRC.getValue("consumoEqu");
                                                        $("numDispFonteOri").value = arrayRetorno.numero;
                                                        $("codDispFonteOri").value = arrayRetorno.tipo;
                                                        $("localChaveFonteOri").value = arrayRetorno.local;
                                                        $("consumoChaveFonteOri").value = arrayRetorno.consumo;
                                                    }else{
                                                        $("numDispFonte").value = arrayRetorno.numero;
                                                        $("codDispFonte").value = arrayRetorno.tipo;
                                                        $("localChaveFonte").value = arrayRetorno.local;
                                                        $("consumoChaveFonte").value = arrayRetorno.consumo;
                                                        $("numDispFonteOri").value = arrayRetorno.numero;
                                                        $("codDispFonteOri").value = arrayRetorno.tipo;
                                                        $("localChaveFonteOri").value = arrayRetorno.local;
                                                        $("consumoChaveFonteOri").value = arrayRetorno.consumo;
                                                    }
                                                    $("tag_fonte_alm").value = "N";										
                                                }else{
                                                    alert("Chave fonte não encontrada.");
                                                    mapFrmRC.setValue("numDispFonte", "");
                                                    mapFrmRC.setValue("codDispFonte", "");
                                                    mapFrmRC.setValue("localChaveFonte", "");
                                                    mapFrmRC.setValue("consumoChaveFonte", "");
                                                    mapFrmRC.setValue("tag_fonte_alm", "");
                                                    $("inserir").disabled = true;
                                                    return false;
                                                }
                                            })
                                        });
                                    }
                                    $("inserir").disabled = false;
                                }else{
                                    alert("Chave fonte não encontrada.");
                                    mapFrmRC.setValue("numDispFonte", "");
                                    mapFrmRC.setValue("codDispFonte", "");
                                    mapFrmRC.setValue("localChaveFonte", "");
                                    mapFrmRC.setValue("consumoChaveFonte", "");
                                    mapFrmRC.setValue("tag_fonte_alm", "");
                                    $("inserir").disabled = true;
                                }
                            }),
                            onFailure : Delegate(this, function(code, message)
                            {
                                alert(message);
                            })
                        });
                    }
                }
                
                function selecionaCodServico(){
                    if(mapFrmRC.getValue("selDescServico") != mapFrmRC.getValue("selCodServico")){
                        for(x=0; x<$("selCodServico").length; x++){
                            if(mapFrmRC.getValue("selDescServico") == $("selCodServico").options[x].value){
                                $("selCodServico").selectedIndex = x;
                            }
                        }
                        if(mapFrmRC.getValue("selCodServico") == ""){
                            $("txtQtdeServ").value = "";
                        }else{
                            $("txtQtdeServ").value = 1;
                        }
                        ManutencaoService.consultas.tiposervico.tipoServicoPorId({"idtiposervico":mapFrmRC.getValue("selCodServico")},
                        {
                            onSuccess : Delegate(this, function(arg)
                            {
                                $("txtUs").value = "";
                                $("txtPontos").value = "";
                                if (arg.rows.length > 0){
                                    for (var i = 0; i < arg.rows.length; i ++){
                                        $("txtUs").value = arg.rows[i].us;
                                        $("txtPontos").value = arg.rows[i].pontos;
                                    }	
                                }
                            })
                        });
                        ManutencaoService.consultas.componente.listaComponentePorServico({"idtiposervico":mapFrmRC.getValue("selCodServico")},
                        {
                            onSuccess : Delegate(this, function(arg)
                            {
                                $("componente").length = 0;
                                if (arg.rows.length > 0){
                                    $("componente").options[0] = new Option("", "");
                                    for (var i = 0; i < arg.rows.length; i ++){
                                        $("componente").options[i + 1] = new Option(arg.rows[i].descricao, arg.rows[i].idcomponente);
                                    }	
                                }
                            })
                        });
                    }
                    limpaFaixa(mapFrmRC.getValue("selCodServico"));
                }

                function selecionaDescServico(){
                    if(mapFrmRC.getValue("selDescServico") != mapFrmRC.getValue("selCodServico")){
                        for(x=0; x<$("selDescServico").length; x++){
                            if(mapFrmRC.getValue("selCodServico") == $("selDescServico").options[x].value){
                                $("selDescServico").selectedIndex = x;
                            }
                        }
                    }
                    if(mapFrmRC.getValue("selDescServico") == ""){
                        $("txtQtdeServ").value = "";
                    }else{
                        $("txtQtdeServ").value = 1;
                    }
                    ManutencaoService.consultas.tiposervico.tipoServicoPorId({"idtiposervico":mapFrmRC.getValue("selCodServico")},
                    {
                        onSuccess : Delegate(this, function(arg)
                        {
                            $("txtUs").value = "";
                            $("txtPontos").value = "";
                            if (arg.rows.length > 0){
                                for (var i = 0; i < arg.rows.length; i ++){
                                    $("txtUs").value = arg.rows[i].us;
                                    $("txtPontos").value = arg.rows[i].pontos;
                                }	
                            }
                        })
                    });
                    ManutencaoService.consultas.componente.listaComponentePorServico({"idtiposervico":mapFrmRC.getValue("selCodServico")},
                    {
                        onSuccess : Delegate(this, function(arg)
                        {
                            $("componente").length = 0;
                            if (arg.rows.length > 0){
                                $("componente").options[0] = new Option("", "");
                                for (var i = 0; i < arg.rows.length; i ++){
                                    $("componente").options[i + 1] = new Option(arg.rows[i].descricao, arg.rows[i].idcomponente);
                                }	
                            }
                        })
                    });
                    limpaFaixa(mapFrmRC.getValue("selCodServico"));
                }
                
                function mudaTipoTrecho(tipo){
                	//Caso tipo trecho for Subterraneo, considerar como area Urbana
                	if(tipo == "S" || tipo == "U"){
                		tipo = "U";
                        $("tipoArea").selectedIndex = 1;
                    }else if(tipo == "R"){
                        $("tipoArea").selectedIndex = 2;
                    }else if(tipo == ""){
                        $("tipoArea").selectedIndex = 0;
                    }
                    $("hdnTipoArea").value = tipo;
                }
                
                function mudaQtdPoste(qtdPoste){
                    if(qtdPoste.value.length > 0 && qtdPoste.value > 0){
            
                        if(mapFrmRC.getValue("identificador") == "" && mapFrmRC.getValue("num_disp") == "" && mapFrmRC.getValue("trafo_pesq") == ""){
                            $("qtdePoste").className = "naoEditavel";
                        }else{
                            $("qtdePoste").className = "editavel";
                        }
            
                        $("latitudeReal").readOnly = false;
                        $("latitudeReal").className = "editavel";
                        $("longitudeReal").readOnly = false;
                        $("longitudeReal").className = "editavel";
            
                        $("antesDepois").disabled = false;
                        $("antesDepois").className = "comboEditavel";
            
                    }else{
            
                        if(mapFrmRC.getValue("identificador") == "" && mapFrmRC.getValue("num_disp") == "" && mapFrmRC.getValue("trafo_pesq") == ""){
                            $("qtdePoste").className = "naoEditavel";
                        }else{
                            $("qtdePoste").className = "editavel";
                        }
            
                        $("latitudeReal").readOnly = true;
                        $("latitudeReal").className = "naoEditavel";
                        $("longitudeReal").readOnly = true;
                        $("longitudeReal").className = "naoEditavel";
                        $("latitudeReal").value = $("latitude").value;
                        $("longitudeReal").value = $("longitude").value;
                        $("antesDepois").disabled = true;
                        $("antesDepois").className = "comboNaoEditavel";
                        $("antesDepois").selectedIndex = 0;
                        if(mapFrmRC.getValue("codNor") == "F" && mapFrmRC.getValue("cod_disp") != "01" && mapFrmRC.getValue("cod_disp") != ""){
                            $("codDispFonte").value = mapFrmRC.getValue("codDispFonteOri");
                            $("numDispFonte").value = mapFrmRC.getValue("numDispFonteOri");
                            $("localChaveFonte").value = mapFrmRC.getValue("localChaveFonteOri");
                            $("consumoChaveFonte").value = mapFrmRC.getValue("consumoChaveFonteOri");
                        }
                    }
                }
                
                function mudaAntesDepois(AD){
                    if(AD.value == "D"){
                        if(mapFrmRC.getValue("codNor") == "F" && mapFrmRC.getValue("cod_disp") != "01" && mapFrmRC.getValue("cod_disp") != ""){
                            $("codDispFonte").value = mapFrmRC.getValue("tipo");
                            $("numDispFonte").value = mapFrmRC.getValue("num_disp");
                            $("localChaveFonte").value = mapFrmRC.getValue("local");
                            $("consumoChaveFonte").value = mapFrmRC.getValue("consumoEqu");
                        }
                    }else{
                        if(mapFrmRC.getValue("codNor") == "F" && mapFrmRC.getValue("cod_disp") != "01" && mapFrmRC.getValue("cod_disp") != ""){
                            $("codDispFonte").value = mapFrmRC.getValue("codDispFonteOri");
                            $("numDispFonte").value = mapFrmRC.getValue("numDispFonteOri");
                            $("localChaveFonte").value = mapFrmRC.getValue("localChaveFonteOri");
                            $("consumoChaveFonte").value = mapFrmRC.getValue("consumoChaveFonteOri");
                        }
                    }
                }
                
                function mudaParaRaioMT(paraRaioMT){
                    if(paraRaioMT.value.length > 0 && paraRaioMT.value == "S"){
                        $("tipo_pararaio").disabled = false;
                        $("tipo_pararaio").className = "comboEditavelObrig";
                    }else{
                        $("tipo_pararaio").selectedIndex = 0;
                        $("tipo_pararaio").disabled = true;
                        $("tipo_pararaio").className = "comboNaoEditavel";
                    }
                }
                
                function desabilitaCampo(tipo){
                    if(tipo == "trafo"){ 
                        $("identificador").disabled = true;
                        $("identificador").className = "naoEditavel";
                        $("BotaoIdentificador").disabled = true;
                        $("BotaoEndereco").disabled = true;
                        $("num_disp").disabled = true;
                        $("num_disp").className = "naoEditavel";
                        $("BotaoEquipamento").disabled = true;
                    }else if(tipo == "endereco"){
                        $("num_disp").disabled = true;
                        $("num_disp").className = "naoEditavel";
                        $("BotaoEquipamento").disabled = true;
                        $("trafo_pesq").disabled = true;
                        $("btnTrafo").disabled = true;
                    }else if(tipo == "equipamento"){
                        $("trafo_pesq").disabled = true;
                        $("trafo_pesq").value = "";
                        $("btnTrafo").disabled = true;
                        $("identificador").disabled = true;
                        $("identificador").value = "";
                        $("identificador").className = "naoEditavel";
                        $("BotaoIdentificador").disabled = true;
                        $("BotaoEndereco").disabled = true;
                        $("qtdePoste").readOnly = false;
                        $("qtdePoste").className = "editavel";
                    }
                }
                
                function buscaInspetor(matInspetor){
                    if(matInspetor == ""){
                        $("nomeInspetor").value = "";
                        $("matInspetor").value = "";
                    }else{
                        ManutencaoService.consultas.usuario.usuariosAtivosInativos({"matfunc":StringUtil.trim(matInspetor)},
                        {
                            onSuccess : Delegate(this, function(arg)
                            {
                                if(arg.rows.length > 0){
                                    $("nomeInspetor").value = StringUtil.trim(arg.rows[0].nomeUsu);
                                    $("matInspetor").value = StringUtil.trim(arg.rows[0].matfunc);
                                }else{
                                    $("nomeInspetor").value = "";
                                    $("matInspetor").value = "";
                                }
                            })
                        });
                    }
                }


                
                function trataCoordenada(coord){
                    var coordInt;
                    var coordFloat;
                    var i;
                    coord = coord.replace("-", "");
                    i = coord.lastIndexOf(".");
                    if(i == -1){
                        coordInt = coord.substring(0,2);
                        coordFloat = "000000";
                    }else{
                        coordInt = coord.substring(0,i);
                        coordFloat = coord.substring(i + 1,coord.length);
                    }
                    if(coordInt.length == 1){
                        coordInt = "0" + coordInt;
                    }else if(coordInt.length == 0){
                        coordInt = "00" + coordInt;
                    }
                    if(coordFloat.length == 5){
                        coordFloat = coordFloat + "0";
                    }else if(coordFloat.length == 4){
                        coordFloat = coordFloat + "00";
                    }else if(coordFloat.length == 3){
                        coordFloat = coordFloat + "000";
                    }else if(coordFloat.length == 2){
                        coordFloat = coordFloat + "0000";
                    }else if(coordFloat.length == 1){
                        coordFloat = coordFloat + "00000";
                    }else if(coordFloat.length == 0){
                        coordFloat = coordFloat + "000000";
                    }
                    return (coordInt + coordFloat);
                }


                
                function verificaHistorico(latitude, longitude, qtdPoste){
                    if(latitude == "-__.______"){
                        return false;
                    }
                    if(qtdPoste != ""){
                        if(mapFrmRC.getValue("antesDepois") == "A"){
                            qtdPoste = "-" + qtdPoste;
                        }else if(mapFrmRC.getValue("antesDepois") == "D"){
                            qtdPoste = mapFrmRC.getValue("qtdePoste");
                        }else if(mapFrmRC.getValue("antesDepois") == ""){
                            qtdPoste = 0;
                        }
                    }else{
                        qtdPoste = 0;        
                    }
                    ManutencaoService.consultas.nota.notaPorLatitudeLongitudePonto({"idnsmanut":0, "latitude":latitude, "longitude":longitude, "qtdPoste":qtdPoste},
                    {
                        onSuccess : Delegate(this, function(arg)
                        {
                            if(arg.rows[0].qtd > 0)
                            {
                                $("btnHistorico").style.display = "block";
                                $("btnHistorico").onclick = function()
                                {
                                    abrirJan('historico.jsp?idnsmanut=0&latitude=' + latitude + '&longitude=' + longitude + '&qtdPoste=' + qtdPoste,'Historico','toollbar=0,width=660,height=350,left=0,top=0,scrolling=auto,scrollbars=yes');
                                }
                            }
                            else
                            {
                                $("btnHistorico").style.display = "none";
                            }
                        })
                    });
                }

                
                function mostraTermografia(tipoInsp){
                    if(tipoInsp == 3)
                    {
                        $("thDeltaT").style.display = "block";
                        $("tdDeltaT").style.display = "block";
                        $("thTermograma").style.display = "block";
                        $("tdTermograma").style.display = "block";
        				$("tdInvisivel").style.display = "none";
        				limpaFaixa(0);
        				$("selCodServico").selectedIndex = 0;
        				$("selDescServico").selectedIndex = 0;
                    }
                    else
                    {
                        $("thDeltaT").style.display = "none";
                        $("tdDeltaT").style.display = "none";
                        $("thTermograma").style.display = "none";
                        $("tdTermograma").style.display = "none";
                        $("tdInvisivel").style.display = "block";
                    }
                }

        		function limpaFaixa(codServ){
        			if((codServ == 193)||(codServ == 194)||(codServ == 320)||(codServ == 2220)||(codServ == 2221)||(codServ == 2231)||(codServ == 2234)){
        			    $("thCoordIni").style.display = "block";
                        $("tdCoordIni").style.display = "block";
                        $("thCoordFim").style.display = "block";
                        $("tdCoordFim").style.display = "block";
                        $("tdInvisivel").style.display = "none";
                        mostraTermografia(0);
        			}else{
        			    $("thCoordIni").style.display = "none";
                        $("tdCoordIni").style.display = "none";
                        $("thCoordFim").style.display = "none";
                        $("tdCoordFim").style.display = "none";
                        //if (codServ != 0) {
                            $("tdInvisivel").style.display = "block";
                        //}else{
                        //    $("tdInvisivel").style.display = "none";
                        //}
            		}
        		}

                

        		function limparAposCadastro() {
        			//location.reload();
        			limpar();
        			habilitaBtnCad();
        		}
        		
                function limpar(){
                    $("folha").value = "";
                    $("qtdePoste").value = "";
                    $("antesDepois").selectedIndex = 0;
                    $("antesDepois").className = "comboNaoEditavel";
                    $("antesDepois").disabled = true;
                    $("latitudeReal").value = $("latitude").value;
                    $("latitudeReal").className = "naoEditavel";
                    $("latitudeReal").readOnly = true;
                    $("longitudeReal").value = $("longitude").value;
                    $("longitudeReal").className = "naoEditavel";
                    $("longitudeReal").readOnly = true;
                    $("tipoPoste").selectedIndex = 0;
                    $("numPoste").value = "";
                    $("chaveDeslocada").selectedIndex = 0;
                    $("facilAcesso").selectedIndex = 0;
                    $("tipo_inspecao").className = "comboNaoEditavel";
                    $("tipo_inspecao").disabled = true;
                    $("terminal_bt").selectedIndex = 0;
                    $("trafo_int").selectedIndex = 0;
                    $("estrutura_bt").selectedIndex = 0;
                    $("bitola_bt").selectedIndex = 0;
                    $("bt_tipo").selectedIndex = 0;
                    $("tDelta").value = "";
                    $("tTermografia").value = "";
                    $("estrutura_mt").selectedIndex = 0;
                    $("bitola_mt").selectedIndex = 0;
                    $("mt_tipo").selectedIndex = 0;
                    $("infComplementares").value = "";
                    $("selDescServico").selectedIndex = 0;
                    $("selCodServico").selectedIndex = 0;
                    $("txtQtdeServ").value = "";
                    $("obsServico").value = "";
                    $("txtPontos").value = "";
                    $("txtUS").value = "";
                    $("componente").selectedIndex = 0;
                    $("componente").length = 1;
                    $("prioridade").selectedIndex = 0;
                    $("equipe").selectedIndex = 0;
                    if( document.all("encabecamento") )
                    {
	                    for(x=0; x < document.all("encabecamento").length;x++)
						{
	                        document.all("encabecamento")[x].checked = false;
	                    }
                    }
                    if( document.all("tangente") )
                    {
	                    for(x=0; x < document.all("tangente").length;x++)
	                    {
	                        document.all("tangente")[x].checked = false;
	                    }
                    }
                    var tbodyElem = document.getElementById("tservicos");
                    while(tbodyElem.rows.length > 0){
                        tbodyElem.deleteRow(0);
                        if(tbodyElem.rows.length == 0){
                            $("tdServicosSel").style.display = "none";
                        }
                    }
                    servicos.excluirTodos();
                    delete servicos;
                    servicos = new ListaServicos();
                    servicos.arrTipoEquipe = arrTipoEquipe;
                    servicos.arrPrioridade = arrPrioridade;
                    EventManager.addListener(servicos,
                    {
                        onAddField : function(lst, field)
                        {
                            mapFrmRC.registerField(field);
                        }
                    });
                }

                function exibirArquivoAnexo(idArquivo){
                	OpenWindowEx("../arquivo_anexo.jsp?id=" + idArquivo, "arquivo_anexo", 800, 600);
                }


                function aceitarNota(){
                	$("IncluirNota").value = "aceitar";
                	document.getElementById("dados").submit();
                }

                function clickBotaoCancelar(){
                    
               	   var confirmacao = confirm("Deseja realmente cancelar a nota?");
               	   
                	   if( confirmacao == true ){
							$("IncluirNota").value = "cancelarNota";
	                    	document.getElementById("dados").submit();
	                    	
                	   }
                }
                
        </script>
        <title>Cadastro de Nota de Serviço Preventiva</title>
        <style>

            .TabelaListaLocal{
                WIDTH: 100%;
            }
            
            .TabelaListaLocal TD{
                FONT-SIZE: 12px !important;
                BACKGROUND: #eeeeee;
                COLOR: #000000 !important;
                FONT-FAMILY: verdana !important;
                TEXT-ALIGN: left !importat;
            }
            
            .TabelaListaLocal TH{
                FONT-WEIGHT: bold !important;
                FONT-SIZE: 12px !important;
                BACKGROUND: #3786d3 !important;
                COLOR: #ffffff !important;
                FONT-FAMILY: verdana !important;
                TEXT-ALIGN: center !important;
            }
            
            .TdTabelaListaMatLocal{
                BACKGROUND: #ffffff !important;
                COLOR: RED !important;
            }
            
            .TabelaListaMatLocal{
                WIDTH: 50%;
                BACKGROUND: #ffffff !important;
            }
            
            .TabelaListaMatLocal TD{
                FONT-SIZE: 12px !important;
                BACKGROUND: #ffffff !important;
                COLOR: #000000 !important;
                FONT-FAMILY: verdana !important;
                TEXT-ALIGN: left !importat;
            }
            
            .TabelaListaMatLocal TH{
                FONT-WEIGHT: bold !important;
                FONT-SIZE: 12px !important;
                BACKGROUND: #3786d3 !important;
                COLOR: #ffffff !important;
                FONT-FAMILY: verdana !important;
                TEXT-ALIGN: center !important;
            }
            .editavel{
                background:#ffffff;
                BORDER-RIGHT: silver 1px solid;
                BORDER-TOP: silver 1px solid;
                FONT-SIZE: 12px;
                /*TEXT-TRANSFORM: uppercase;*/
                BORDER-LEFT: silver 1px solid;
                COLOR: #4e4e4e;
                BORDER-BOTTOM: silver 1px solid;
                FONT-FAMILY: verdana
            }
            .editavelObrig{
                background:#ffffcc;
                BORDER-RIGHT: silver 1px solid;
                BORDER-TOP: silver 1px solid;
                FONT-SIZE: 12px;
                TEXT-TRANSFORM: uppercase;
                BORDER-LEFT: silver 1px solid;
                COLOR: #4e4e4e;
                BORDER-BOTTOM: silver 1px solid;
                FONT-FAMILY: verdana
            }
            .naoEditavel{
                background:#f1f1f1;
                BORDER-RIGHT: silver 1px solid;
                BORDER-TOP: silver 1px solid;
                FONT-SIZE: 12px;
                TEXT-TRANSFORM: uppercase;
                BORDER-LEFT: silver 1px solid;
                COLOR: #4e4e4e;
                BORDER-BOTTOM: silver 1px solid;
                FONT-FAMILY: verdana;
            }
            .comboEditavel{
                background:#ffffff;
                BORDER-RIGHT: #c69c67 0px solid;
                BORDER-TOP: #c69c67 0px solid;
                FONT-SIZE: 12px;
                TEXT-TRANSFORM: uppercase;
                BORDER-LEFT: #c69c67 0px solid;
                COLOR: #4e4e4e;
                BORDER-BOTTOM: #c69c67 0px solid;
                FONT-FAMILY: verdana;
            }
            .comboNaoEditavel{
                background:#f1f1f1;
                BORDER-RIGHT: #c69c67 0px solid;
                BORDER-TOP: #c69c67 0px solid;
                FONT-SIZE: 12px;
                TEXT-TRANSFORM: uppercase;
                BORDER-LEFT: #c69c67 0px solid;
                COLOR: #4e4e4e;
                BORDER-BOTTOM: #c69c67 0px solid;
                FONT-FAMILY: verdana;
            }
            .comboEditavelObrig{
                background:#ffffcc;
                BORDER-RIGHT: #c69c67 0px solid;
                BORDER-TOP: #c69c67 0px solid;
                FONT-SIZE: 12px;
                TEXT-TRANSFORM: uppercase;
                BORDER-LEFT: #c69c67 0px solid;
                COLOR: #4e4e4e;
                BORDER-BOTTOM: #c69c67 0px solid;
                FONT-FAMILY: verdana;
            }
            .checkEditavel{
                background:#ffffff;
            }
            .checkNaoEditavel{
                background:#f1f1f1;
            }
        </style>
    </head>
    <body topmargin="0" leftmargin="0" bgcolor="white" rightmargin="0">
        



<script language="JavaScript" src="/contratadaweb/condis/templates/azul/ThemeMenu.js"></script>
<script language="JavaScript" src="/contratadaweb/condis/include/cliente/classes/clsMenu_v1.js"></script>
<script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/Delegate.js"></script>
<script language="javascript" src="/contratadaweb/biblio/Js/ajax/MCAjax.js"></script>

<link rel="stylesheet" href="/contratadaweb/condis/templates/azul/css/formata.css">
<link rel="stylesheet" href="/contratadaweb/condis/templates/azul/css/print.css" media="print">

        <form name="dados" id="dados" target="iframeComandos" method="post" action="ns_preventiva_action.jsp" enctype="multipart/form-data" onSubmit="return checaDados();">
            <input type="hidden" name="malhas" id="malhas">
            <input type="hidden" name="todasMalhas" id="todasMalhas">
            <table align="center" class="TabelaForm" border="0" bordercolor="red" width="80%">
                <caption>Nota de Serviço de Manutenção Preventiva</caption>
                <!--BOTÕES DE PESQUISA-->
                <tr>
                    <td colspan="12">
                        <fieldset style="padding-bottom:5px;">
                            
                            <legend style="color:#505050"><b>Pesquisas</b></legend>
                            <table width="100%" class="TabelaForm" style="border:0px">
                                <tr>
                                    <th width="160">P. de Instalação:</th>
                                    <td colspan="5">
                                        <input name="identificador" size="14" mask="number" maxlength="10" class='editavel' desc="P. de Instalação" value="" promptChar=" " insertMode="true">
                                        <input type="button" name="BotaoIdentificador" id="BotaoIdentificador" title="Consultar por Ponto de Instalação" value="Buscar" class="botao1" style="HEIGHT:18px;width:60px" >&nbsp;
                                        <input type="button" name="BotaoEndereco" id="BotaoEndereco" title="Consultar pelo Endereço" value="Endereço" class="botao1" style="HEIGHT:18px;width:60px" >
                                    </td>	
                                    <th>Eqpto:</th>
                                    <td nowrap>
                                        <input type="text" name="num_disp" id="num_disp" size="14" mask="number" maxlength="9" class='editavel' value="" promptChar=" " insertMode="true">
                                        <span name="malhaEqu" id="malhaEqu" style="color:red;font-weight:bold"></span>&nbsp;
                                        <input type="button" name="BotaoEquipamento" id="BotaoEquipamento" title="Consultar pelo Número do Equipamento" value="Buscar" class="botao1" style="HEIGHT: 18px; width:60px" >
                                    </td>
                                    <th>Trafo:</th>
                                    <td nowrap>
                                        <input type="text" name="trafo_pesq" id="trafo_pesq" size="14" maxlength="12" class="naoEditavel" readonly>
                                        <input type="button" name="btnTrafo" id="btnTrafo" title="Consultar Transformador" value="Buscar" class="botao1" style="HEIGHT: 18px; width:60px" >
                                    </td>
                                </tr>
                            </table>
                            
                        </fieldset>
                    </td>
                </tr>
                <!--FIM BOTÕES DE PESQUISA-->
                <tr>
                    <td></td>
                </tr>
                <tr>
                    <!--TIPO DISPOSITIVO-->
                    <th nowrap>Tipo Disp:</th>
                    <td colspan="5" style="width:350px;"> 
                        <select name="tipo" id="tipo" class="comboNaoEditavel" disabled style="width:100%">
                            <option value=""></option>
                            <option value='01'>01 - TRANSFORMADOR DE DISTRIBUICAO </option><option value='02'>02 - REGULADOR DE TENSAO           </option><option value='03'>03 - AUTOTRANSFORMADOR MT          </option><option value='04'>04 - CHAVE FUSIVEL REPETIDORA MT   </option><option value='06'>06 - CHAVE A OLEO                  </option><option value='11'>11 - CH SECC. MT TRIP. OP. S/CARGA </option><option value='12'>12 - TC                            </option><option value='13'>13 - BANCO CAPACITORES             </option><option value='14'>14 - COBERTURA PROTETORA           </option><option value='15'>15 - TRAFO MT AUTO-PROTEGIDO       </option><option value='16'>16 - INSTAL. INTERNA CONSUMIDORES  </option><option value='17'>17 - JUMPER/FLYING-TAP             </option><option value='19'>19 - CHAVE SECCIONADORA MT SF6 C.R.</option><option value='20'>20 - CHAVE SECCIONADORA MT SF6     </option><option value='21'>21 - DISJUNTOR                     </option><option value='22'>22 - RELIGADOR                     </option><option value='23'>23 - SECCIONALIZADOR CONVENCIONAL  </option><option value='24'>24 - CHAVE FUSIVEL MT DERIVACAO    </option><option value='25'>25 - SECCIONALIZADOR TIPO CARTUCHO </option><option value='26'>26 - TRAFO ATERRAMENTO             </option><option value='27'>27 - CH SECC. MT TRIP.OP. EM CARGA </option><option value='28'>28 - CHAVE SECCIONADORA MT UNIP.   </option><option value='29'>29 - ELO FUSIVEL                   </option><option value='30'>30 - TRAFO MT CONVENCIONAL         </option><option value='31'>31 - POSTE DE ACO                  </option><option value='32'>32 - RD                            </option><option value='33'>33 - ISOLADOR DE PINO PORCELANA    </option><option value='34'>34 - CHAVE A VACUO                 </option><option value='35'>35 - OUTROS                        </option><option value='36'>36 - CHAVE FACA ADAPTADA           </option><option value='37'>37 - ISOLADOR - OUTROS             </option><option value='38'>38 - CRUZETA                       </option><option value='39'>39 - ESTAI                         </option><option value='41'>41 - CONETOR PARAFUSO FENDIDO      </option><option value='42'>42 - CONETOR PARALELO PARAFUSO     </option><option value='43'>43 - CONETOR COMPRESSAO UNIVERSAL  </option><option value='44'>44 - CONETOR COMPRESSAO FORMATO H  </option><option value='45'>45 - CONETOR DE CUNHA              </option><option value='46'>46 - CONETOR TERMINAL DE COMPRESSAO</option><option value='47'>47 - CONETOR TERMINAL PARAFUSO     </option><option value='48'>48 - CONETOR - OUTROS              </option><option value='50'>50 - SECCIONAMENTO OPERATIVO       </option><option value='51'>51 - LUVA DE COMPRESSAO            </option><option value='56'>56 - MUFLA - TERMINAL DE MT        </option><option value='57'>57 - BARRAMENTO ISOLADO PARA BT    </option><option value='58'>58 - EMENDA PREFORMADA             </option><option value='59'>59 - MATERIAL PREFORMADO           </option><option value='60'>60 - CH MANOBRA SUB                </option><option value='61'>61 - CH PROTECAO SUB               </option><option value='71'>71 - FIO / CABO NU DE COBRE        </option><option value='72'>72 - CABO NU DE ALUMINIO BITOLA 4  </option><option value='73'>73 - CABO NU DE ALUMINIO BITOLA 2  </option><option value='74'>74 - CABO NU DE ALUMINIO BITOLA 1/0</option><option value='76'>76 - CABO NU DE ALUMINIO BITOLA 4/0</option><option value='77'>77 - CABO NU ALUMINIO BITOLA 336,4 </option><option value='78'>78 - CABO NU ALUMINIO OUTRAS BIT.  </option><option value='79'>79 - CABO MULTIPLEXADO DE RDA      </option><option value='80'>80 - CABO PROTEGIDO DE MT          </option><option value='82'>82 - RAMAL DE CONSUMIDOR AEREO WPP </option><option value='83'>83 - RAMAL CONSUMIDOR AEREO MULTP. </option><option value='84'>84 - RAMAL CONSUMIDOR SUBTERRANEO  </option><option value='85'>85 - JUMPER / FLYING-TAP           </option><option value='87'>87 - CABO SAIDA TR AEREO/BARRAMENTO</option><option value='98'>98 - OUTROS EQUIPAMENTOS           </option><option value='99'>99 - NAO HOUVE EQUPTO. DANIFICADO  </option>
                        </select>
                        <input type="hidden" id="cod_disp" name="cod_disp">
                    </td>
                    <!--FIM TIPO DISPOSITIVO-->
                    <!--SUBALIM-->
                    <th>Sub/Alim:</th>
                    <td>
                        <input name="subalim" id="subalim" size="8" maxlength="7" class="naoEditavel" nome="SubAlim" value="" readonly>
                    </td>
                    <!--FIM SUBALIM-->
                    <!--ELOFUSIVEL-->
                    <th nowrap style="width:90px">Elo Fusível:</th>
                    <td colspan="2">
                        <input name="eloFusivel" id="eloFusivel" value="" size="8" class="naoEditavel" nome="Elo Fusível" value="" readonly>
                    </td>
                    <td colspan="2" rowspan="2" align="right">
                        <img src="/contratadaweb/imagens/warning.png" name="btnHistorico" id="btnHistorico" title="Serviços do ponto" style="display:none;" style="cursor:pointer;">
                    </td>
                    <!--FIM ELOFUSIVEL-->
                </tr>    
                <tr> 
                    <!--ENDERECO-->
                    <th>Rua/Av.:</th>
                    <td colspan="5" style="width: 350px;">
                        <input type="hidden" name="tipologradouro" id="tipologradouro" value="">
                        <input type="hidden" name="idEndereco" id="numeroEndereco" value="">                        
                        <input type="text" name="endereco" size="42" class="naoEditavel" nome="Rua/Av." value="" readonly>
                    </td>
                    <!--FIM ENDERECO-->
                    <!--NUMERO-->
                    <th>Número:</th>
                    <td>
                        <input type="text" name="numEndereco" id="numEndereco" size="6" maxlength="5" class="naoEditavel" nome="Número" value="" readonly>
                    </td>
                    <!--FIM NUMERO-->
                    <!--BAIRRO-->
                    <th>Bairro:</th>
                    <td colspan="3">
                        <input type="text" name="bairro" id="bairro" size="22" maxlength="40" nome="BAIRRO" value=""  caseType="upper" class='editavel'>
                    </td>
                    <!--FIM BAIRRO-->
                </tr>
                <tr> 
                    <!--REFERENCIA-->
                    <th>Referência:</th>
                    <td colspan="5" style="width:350px;">
                        <input type="text" name="referencia" id="referencia" class='editavel' size="42" maxlength="40" nome="Referência" value=""  caseType="upper">
                    </td>
                    <!--FIM REFERENCIA-->
                    <!--COMPLEMENTO-->
                    <th>
                        Compl.:</th>
                    <td>
                        <input type="text" name="compl" id="compl" size="18" maxlength="6" class='editavel' caseType="upper" value="">
                    </td>
                    <!--FIM COMPLEMENTO-->
                    <!--DDDTELEFONE-->
                    <th>
                        DDD/Tel:
                    </th>
                    <td colspan="3">
                        <input type="text" name="ddd" size="3" maxlength="2" class="naoEditavel" nome="DDD" value="" readonly>
                        <input type="text" name="telefone" size="9" maxlength="8" class="naoEditavel" nome="telefone" value="" readonly>
                    </td>
                    <!--FIM DDDTELEFONE-->
                </tr>
                <tr>
                    <!--REGIAO-->
                    <th>Região:</th>
                    <td>
                        <input type="text" name="regiao" id="regiao" class="naoEditavel" size="3" readonly value="" nome="Regiao">
                    </td>
                    <!--FIM REGIAO-->
                    <!--LOCAL-->
                    <th>Local:</th>
                    <td style="width:150px;" colspan="3">
                        <input type="text" name="local" id="local" class="naoEditavel" size="35" nome="Local" value="" readonly>
                    </td>
                    <!--FIM LOCAL-->
                    <!--TRAFO-->
                    <th>Trafo:</th>
                    <td>
                        <input type="text" id="trafo" name="trafo" size="18" maxlength="20" class="naoEditavel" nome="Transformador" value="" readonly>
                    </td>
                    <!--FIM TRAFO-->
                    <!--CARREGAMENTO-->
                    <th>Carga:</th>
                    <td colspan="3">
                        <input type="text" id="carregamento" name="carregamento" size="12" maxlength="10" class="naoEditavel" nome="Carregamento" readonly value="" title="Carregamento">&nbsp;
                        <b><font style="color:#505050">kVA</font></b>
                    </td>
                    <!--FIM CARREGAMENTO-->
                </tr>
                <tr>
                    <!--COORDENADA-->
                    <th width="5%">
                        Coord:
                    </th>
                    <td colspan="2" nowrap>
                        <input type="text" name="latitude" id="latitude" class="naoEditavel" size="11" nome="Latitude" mask="custom" maskFormat="-99.999999" maxlength="10" value="" readonly includePromptCharInValue="true">
                    </td>
                    <td>
                        <input type="text" name="longitude" id="longitude" class="naoEditavel" size="11" nome="Longitude" mask="custom" maskFormat="-99.999999" maxlength="10" value="" readonly includePromptCharInValue="true">
                    </td>
                    <!--FIM COORDENADA-->
                    <!--FOLHA-->
                    <th>Folha:</th>
                    <td>
                        <input type="text" name="folha" id="folha" class='editavel'  caseType="upper" maxlength="8" value="" style="width:78px;">
                    </td>
                    <!--FIM FOLHA-->
                    <!--QTD POSTE-->
                    <th nowrap>
                <div align="right">Qtde Poste:</div>
                </th>
                <td>
                    <input name="qtdePoste" id="qtdePoste" size="4" maxlength="4" class="naoEditavel" readonly value="" mask="number" caseType="upper" promptChar=" ">
                    <select name="antesDepois" id="antesDepois" class="comboNaoEditavel" disabled>
                        <option value=""></option>
                        <option value="A" >Antes</option>
                        <option value="D" >Depois</option>
                    </select>
                </td>
                <!--FIM QTD POSTE-->
                <!--COORDENADA REAL-->
                <th width="5%" nowrap>
                    Coord Real:
                </th>
                <td colspan="3" nowrap>
                    <input type="text" name="latitudeReal" id="latitudeReal" size="11" nome="Latitude" mask="custom" maskFormat="-99.999999" maxlength="10" class="naoEditavel" readOnly value="" includePromptCharInValue="true">
                    <input type="text" name="longitudeReal" id="longitudeReal" size="11" nome="Longitude" mask="custom" maskFormat="-99.999999" maxlength="10" class="naoEditavel" readOnly value="" includePromptCharInValue="true">
                </td>
                <!--FIM COORDENADA REAL-->
                </tr>
                <tr>
                    <!--SOLICITANTE-->
                    <th>Solicitante:</th>
                    <td colspan="5" nowrap>
                        <input type="text" name="matSolicit" id="matSolicit"   value="e252135" nome="Matricula Solicitante" size="8" maxlength="8" class="naoEditavel" readonly>
                        <input type="text" name="nomeSolicit" id="nomeSolicit" value="MATHEUS DE OLIVEIRA GALDINO" nome="Solicitante" size="30" maxlength="30" class="naoEditavel"  caseType="upper" readonly>
                    </td>
                    <!--FIM SOLICITANTE-->
                    
                    
                    <!--ORIGEM-->
                    <th>Origem:</th>
                    <td colspan="1" nowrap>
                    	
	                    	
		                    	
		                        	<input type="text" name="origem" id="origem" nome="Origem" size="18" 
		                        		class="naoEditavel" readonly value="Manutenção">
		                    	
		                    	
	                    	
	                    	
                    	
                    </td>
                    <!--FIM ORIGEM-->
                </tr>
                <tr>
                    <!--EMPREITEIRA CADASTRO: empreiteiraCadastro -->
                    <th>Empreiteira cadastro:</th>
                    <td colspan="5" nowrap>
                    	
	                    	
		                        <input type="text" name="empreiteiraCadastro" id="empreiteiraCadastro" nome="empreiteiraCadastro" 
		                        	size="55" class="naoEditavel" readonly="readonly" 
		                        	value="ENGELMIG ELETRICA LTDA"/>
	                    	
	                    	
                    	
                    	<input type="hidden" id="idEmpreiteira" name="idEmpreiteira" value="9">
                    </td>
                    <!--FIM EMPREITEIRA CADASTRO-->
                    <!--AREA-->
                    <th>Área:</th>
                    <td>
                        <select name="tipoArea" id="tipoArea" class="comboNaoEditavel" disabled nome="Area">
                            <option value=""></option>
                            <option value="U" >URBANA</option>
                            <option value="R" >RURAL</option>
                        </select>
                        <input type="hidden" name="hdnTipoArea" id="hdnTipoArea" value="">
                    </td>
                    <!--FIM AREA-->
                    <!--CHAVE FONTE-->
                    <th>Chave Fonte:</th>
                    <td nowrap colspan="3">
                        <input name="numDispFonte" id="numDispFonte" size="10" class="naoEditavel" readonly value="" title="Número chave fonte">
                        <input name="codDispFonte" id="codDispFonte" size="2" class="naoEditavel" readonly value="" title="Tipo chave fonte">
                        <input name="localChaveFonte" id="localChaveFonte" size="4" class="naoEditavel" readonly value="" title="Local chave fonte">
                        <input name="consumoChaveFonte" id="consumoChaveFonte" size="8" class="naoEditavel" readonly value="" title="Consumo chave fonte">&nbsp;
                        <b><font style="color:#505050">kWh</font></b> 
                    </td>
                    <!--FIM CHAVE FONTE-->
                </tr>
                <!-- Motivo causa-->
                <tr>
                	<th>Motivo/Causa:</th>
					<td colspan="5" style="width:350px;">
						<select name="motivoCausa" id="motivoCausa" nome="Motivo Causa" class='editavel' style="width:100%;">
							<option value=""></option>
							<option value='1'>1 - ABALROAMENTO</option><option value='2'>2 - AGRESSIVIDADE DO MEIO AMBIENTE</option><option value='3'>3 - ANIMAL</option><option value='4'>4 - AQUECIMENTO</option><option value='5'>5 - BAIXO ISOLAMENTO</option><option value='6'>6 - CURTO-CIRCUITO</option><option value='7'>7 - DESCARGA ATMOSFÉRICA</option><option value='31'>31 - DETERIORADO</option><option value='8'>8 - ENCHENTE</option><option value='9'>9 - ENVELHECIMENTO</option><option value='10'>10 - EROSÃO / DESLOCAMENTO DO SOLO</option><option value='11'>11 - ERRO DE PROJETO</option><option value='12'>12 - EXECUÇÃO INADEQUADA DE MANUTENÇÃO</option><option value='13'>13 - FABRICAÇÃO</option><option value='14'>14 - FURTO / ROUBO</option><option value='15'>15 - INCÊNDIO</option><option value='16'>16 - INDETERMINADA</option><option value='17'>17 - MATERIAL</option><option value='18'>18 - MONTAGEM</option><option value='19'>19 - OPERAÇÃO INADEQUADA DO EQUIPAMENTO</option><option value='21'>21 - PIPA</option><option value='30'>30 - PODRE</option><option value='22'>22 - PROBLEMAS OPERACIONAIS NO SISTEMA</option><option value='20'>20 - PÁSSAROS</option><option value='23'>23 - QUEIMADA</option><option value='24'>24 - SOBRECARGA</option><option value='25'>25 - SOBRETENSÃO</option><option value='26'>26 - SUBTENSÃO</option><option value='27'>27 - VANDALISMO</option><option value='28'>28 - VEGETAÇÃO</option><option value='29'>29 - VENTO</option>
						</select>
					</td>
                </tr>
                <!-- Fim Motivo causa-->
                <tr>
                    <!--TIPO POSTE-->
                    <th>Tipo de Poste:</th>
                    <td colspan="5" style="width:350px;">
                        <select name="tipoPoste" id="tipoPoste" class='comboEditavel' nome="Tipo de Poste" style="width:100%;">
                            <option value=""></option>
                            <option value='1'>CC 10m 150daN</option><option value='2'>CC 10m 300daN</option><option value='3'>CC 10m 600daN</option><option value='4'>CC 11m 1000daN</option><option value='5'>CC 11m 300daN</option><option value='6'>CC 11m 600daN</option><option value='7'>CC 12m 1000daN</option><option value='8'>CC 12m 300daN</option><option value='9'>CC 12m 600daN</option><option value='10'>CC 13m 1000daN</option><option value='11'>CC 13m 300daN</option><option value='12'>CC 13m 600daN</option><option value='13'>CC 9m 150daN</option><option value='14'>CC 9m 200daN</option><option value='15'>DT 10m 150daN</option><option value='16'>DT 10m 300daN</option><option value='17'>DT 10m 300daN RET CX</option><option value='18'>DT 10m 600daN</option><option value='19'>DT 11m 300daN</option><option value='20'>DT 11m 600daN</option><option value='21'>DT 12m 300daN</option><option value='22'>DT 12m 600daN</option><option value='23'>DT 13m 300daN</option><option value='24'>DT 13m 600daN</option><option value='25'>DT 15m 600daN</option><option value='26'>DT 18m 600daN</option><option value='27'>DT 9m 150daN</option><option value='28'>MD 10m 150daN</option><option value='29'>MD 10m 300daN</option><option value='30'>MD 10m 600daN</option><option value='31'>MD 11m 300daN</option><option value='32'>MD 11m 600daN</option><option value='33'>MD 12m 300daN</option><option value='34'>MD 12m 600daN</option><option value='36'>MD 13m 600daN</option><option value='37'>MD 15m 300daN</option><option value='38'>MD 15m 600daN</option><option value='39'>MD 16m 600daN</option><option value='41'>MD 19m 600daN</option><option value='42'>MD 20m 600daN</option><option value='43'>MD 9m 150daN</option><option value='44'>RETO 12m POL COM</option><option value='45'>RETO 16m POL ACO </option><option value='46'>RETO 16m POL COM</option><option value='47'>RETO 6,8m CHIC S/D</option><option value='48'>RETO 9,8m CHIC S/D</option>
                        </select>
                    </td>
                    <!--FIM TIPO POSTE-->
                    <!--NUM POSTE-->
                    <th nowrap>Nº do Poste:</th>
                    <td>
                        <input type="text" name="numPoste" id="numPoste" class='editavel'  caseType="upper" maxlength="5" value="" size="10">
                    </td>
                    <!--FIM NUM POSTE-->
                    <!--CHAVE DESLOCADA-->
                    <th>Chave Deslocada:</th>
                    <td style="width:55px;">
                        <select name="chaveDeslocada" id="chaveDeslocada" class='comboEditavel' nome="Chave Deslocada" style="width:100%;">
                            <option value=""></option>
                            <option value="S" >SIM</option>
                            <option value="N" >NÃO</option>
                        </select>
                    </td>
                    <!--FIM CHAVE DESLOCADA-->
                    <!--FACIL ACESSO-->
                    <th>Fácil Acesso:</th>
                    <td style="width:100px;">
                        <select name="facilAcesso" id="facilAcesso" class='comboEditavel' nome="facilAcesso">
                            <option value=""></option>
                            <option value="S" >Sim</option>
                            <option value="N" >Não</option>
                        </select>
                    </td>
                    <!--FIM FACIL ACESSO-->
                </tr>
                <tr>
                    <!--TIPO INSPECAO-->
                    <th style="width:160px;">
                        Tipo Inspeção:
                    </th>
                    <td colspan="5">
                        <select name="tipo_inspecao" id="tipo_inspecao" class='comboEditavelObrig' nome="TipoInspecao">
                            <option value=""></option>
                            <option value='1' >RÁPIDA</option><option value='2' >BÁSICA</option><optgroup label='Especial'><option value='3' >TERMOGRÁFICA</option><option value='4' >VISUAL</option><option value='6' >LEVANTAMENTO DE PODA</option><option value='8' >LEVANTAMENTO DE FAIXA</option><option value='9' >NS OPERAÇÃO</option><option value='10' >PS CCS</option><option value='12' >AEREA</option><option value='13' >LINHA VIVA</option><option value='14' >EM EQUIPAMENTO</option><option value='15' >DRONE</option><option value='16' >TERMICA</option><option value='17' >VISUAL E TERMICA</option><option value='18' >DRONE - ADITIVO</option><option value='19' >ARVORE - APP</option>
                        </select>
                        <input type="hidden" id="hdnTipo_inspecao" name="hdnTipo_inspecao" value="">
                    </td>
                    <!--FIM TIPO INSPECAO-->
                    <!--TIPO BARRA-->
                    <th style="width:160px;">
                        Terminal BT<br>tipo barra:
                    </th>
                    <td>
                        <select name="terminal_bt" id="terminal_bt" class='comboEditavel'>
                            <option value=""></option>
                            <option value="S" >SIM</option>
                            <option value="N" >NÃO</option>
                        </select>
                    </td>
                    <!--FIM TIPO BARRA-->
                    <!--TRAFO INTERLIGADO-->
                    <th style="width:90px;">
                        Trafo Interligado:
                    </th>
                    <td>
                        <select name="trafo_int" id="trafo_int" class='comboEditavel'>
                            <option value=""></option>
                            <option value="S" >SIM</option>
                            <option value="N" >NÃO</option>
                        </select>
                    </td>
                    <!--FIM TRAFO INTERLIGADO-->
                </tr>
                <tr>
                    <!--td colspan="12">
                        <table width="100%" align="center">
                            <tr-->
                    <!--ESTRUTURA BT-->
                    <th style="width:95px;">Estrutura BT:</th>
                    <td colspan="5">
                        <select name="estrutura_bt" id="estrutura_bt" class='comboEditavel' nome="Estrutura BT">
                            <option value=""></option>
                            <option value='58'>S1</option><option value='59'>S2</option><option value='60'>S3</option><option value='61'>S4</option><option value='93'>SI1</option><option value='94'>SI3</option><option value='95'>SI4</option>
                        </select>
                    </td>
                    <!--FIM ESTRUTURA BT-->
                    <!--BITOLA BT-->
                    <th style="width:75px;">Bitola BT:</th>
                    <td style="width:130px;">
                        <select name="bitola_bt" id="bitola_bt" class='comboEditavel' nome="Bitola BT" style="width:100%;">
                            <option value=""></option>
                            <option value='27'>1/0 CA</option><option value='28'>1/0 CAA</option><option value='37'>120 mm²</option><option value='38'>150 mm²</option><option value='39'>185 mm²</option><option value='25'>2 CA</option><option value='26'>2 CAA</option><option value='34'>2 CU</option><option value='35'>2/0 CU</option><option value='40'>240 mm²</option><option value='31'>336 CA</option><option value='32'>336 CAA</option><option value='23'>4 CA</option><option value='24'>4 CAA</option><option value='33'>4 CU</option><option value='29'>4/0 CA</option><option value='30'>4/0 CAA</option><option value='41'>400 mm²</option><option value='36'>50 mm²</option><option value='43'>DUP   1X1X16+16</option><option value='44'>DUP   1X1X25+25</option><option value='42'>DUP  CA 1X1X10+10</option><option value='45'>QUAD  3X1X 16+16</option><option value='46'>QUAD  3X1X 35+70</option><option value='47'>QUAD  3X1X 70+70</option><option value='48'>QUAD  3X1X120+70</option><option value='49'>TRIP  2X1X10+10</option><option value='50'>TRIP  2X1X16+16</option><option value='51'>TRIP  2X1X35+70</option><option value='52'>TRIP  2X1X70+70</option>
                        </select>
                    </td>
                    <!--FIM BITOLA BT-->
                    <!--TIPO BT-->
                    <th nowrap>BT tipo:</th>
                    <td>
                        <select name="bt_tipo" id="bt_tipo" class='comboEditavel'>
                            <option value=""></option>
                            <option value='1'>CONVENCIONAL</option><option value='2'>ISOLADA</option><option value='3'>SUBTERRANEA</option>
                        </select>
                    </td>
                    <!--FIM TIPO BT-->
                </tr>
                <tr>
                    <!--ESTRUTURA MT-->
                    <th style="width:95px;">Estrutura MT:</th>
                    <td colspan="5">
                        <select name="estrutura_mt" id="estrutura_mt" class='comboEditavel' nome="Estrutura MT">
                            <option value=""></option>
                            <option value='1'>B1</option><option value='76'>B1-B3</option><option value='3'>B1-N3</option><option value='2'>B1E</option><option value='4'>B2</option><option value='6'>B2-M3</option><option value='5'>B2E</option><option value='7'>B3</option><option value='77'>B3-2</option><option value='8'>B4</option><option value='107'>B4E</option><option value='9'>C1</option><option value='10'>C2</option><option value='11'>C3</option><option value='12'>C4</option><option value='18'>CE-J1</option><option value='78'>CE-J2</option><option value='13'>CE1</option><option value='126'>CE1S</option><option value='14'>CE2</option><option value='123'>CE2-CEM3</option><option value='120'>CE2.3</option><option value='122'>CE2.3 . CE3</option><option value='121'>CE2.CE3</option><option value='15'>CE3</option><option value='17'>CE3-CE3</option><option value='16'>CE4</option><option value='125'>CEJ2-I3</option><option value='108'>CEM2</option><option value='109'>CEM3</option><option value='110'>CEM4</option><option value='111'>CEN3</option><option value='104'>CEN4</option><option value='112'>CM1</option><option value='113'>CM2</option><option value='114'>CM3</option><option value='119'>CM3-CM3</option><option value='115'>CM4</option><option value='116'>CMIS</option><option value='117'>CMJ1</option><option value='118'>CMJ2</option><option value='34'>ESPECIAL</option><option value='19'>HT</option><option value='100'>HT-N3</option><option value='99'>HT-U3</option><option value='20'>HTE</option><option value='79'>HTT</option><option value='21'>M1</option><option value='124'>M1-CE3</option><option value='90'>M1-M1</option><option value='22'>M1-M2</option><option value='23'>M1-M3</option><option value='24'>M1-N2</option><option value='80'>M1-N3</option><option value='25'>M1-U3</option><option value='26'>M2</option><option value='102'>M2 M2</option><option value='27'>M2-M3</option><option value='28'>M2-N3</option><option value='29'>M2-U3</option><option value='96'>M23</option><option value='30'>M3</option><option value='31'>M3-2</option><option value='81'>M3-M3</option><option value='82'>M3-U3</option><option value='32'>M4</option><option value='84'>M4-M2</option><option value='83'>M4-M3</option><option value='33'>M4-M3</option><option value='87'>M4-N2</option><option value='86'>M4-N3</option><option value='85'>M4-U3</option><option value='35'>N1</option><option value='36'>N1-M2</option><option value='37'>N1-M3</option><option value='89'>N1-N1</option><option value='38'>N1-N2</option><option value='39'>N1-N3</option><option value='40'>N1-N4</option><option value='41'>N1-U3</option><option value='42'>N2</option><option value='44'>N2-M1</option><option value='45'>N2-N2</option><option value='46'>N2-N3</option><option value='43'>N2-U3</option><option value='47'>N3</option><option value='48'>N3-2</option><option value='49'>N3-M3</option><option value='50'>N3-N1</option><option value='51'>N3-N3</option><option value='52'>N3-N4</option><option value='53'>N4</option><option value='88'>N4-M3</option><option value='54'>N4-N2</option><option value='55'>N4-N3</option><option value='56'>N4-N4</option><option value='57'>N4-U3</option><option value='62'>T1</option><option value='63'>T1-U3</option><option value='91'>T2</option><option value='64'>T4</option><option value='105'>T4-U3</option><option value='106'>T4-U3-U3</option><option value='65'>TE</option><option value='98'>TE-N2</option><option value='97'>TE-N3</option><option value='103'>TE-U3</option><option value='66'>U1</option><option value='67'>U1-U3</option><option value='68'>U2</option><option value='69'>U2-U3</option><option value='70'>U3</option><option value='71'>U3-2</option><option value='72'>U3-U3</option><option value='73'>U4</option><option value='74'>U4-U3</option>
                        </select>
                    </td>
                    <!--FIM ESTRUTURA MT-->
                    <!--BITOLA MT-->
                    <th style="width:75px;">Bitola MT:</th>
                    <td style="width:130px;">
                        <select name="bitola_mt" id="bitola_mt" class='comboEditavel' nome="Bitola MT" style="width:100%;">
                            <option value=""></option>
                            <option value='5'>1/0 CA</option><option value='6'>1/0 CAA</option><option value='15'>120 MM²</option><option value='16'>150 mm²</option><option value='17'>185 mm²</option><option value='3'>2 CA</option><option value='4'>2 CAA</option><option value='12'>2 CU</option><option value='13'>2/0 CU</option><option value='18'>240 mm²</option><option value='9'>336 CA</option><option value='10'>336 CAA</option><option value='21'>3X 120+3/8P AL</option><option value='22'>3X 185+3/8P AL</option><option value='20'>3X 50+3/8P AL</option><option value='1'>4 CA</option><option value='2'>4 CAA</option><option value='11'>4 CU</option><option value='7'>4/0 CA</option><option value='8'>4/0 CAA</option><option value='19'>400 mm²</option><option value='14'>50 mm²</option>
                        </select>
                    </td>
                    <!--FIM BITOLA BT-->
                    <!--TIPO MT-->
                    <th nowrap>MT tipo:</th>
                    <td>
                        <select name="mt_tipo" id="mt_tipo" class='comboEditavel'>
                            <option value=""></option>
                            <option value='4'>CONVENCIONAL</option><option value='5'>ISOLADA</option><option value='6'>PROTEGIDA</option><option value='7'>SUBTERRANEA</option>
                        </select>
                    </td>
                    <!--FIM TIPO MT-->
                    <!--/tr>
                </table>
            <td-->
                </tr>
                <tr>
                    <!--INSPETOR-->
                    <th>Inspetor:</th>
                    <td colspan="5">
                        <input type="text" name="matInspetor" id="matInspetor" class='editavelObrig' size="8" maxlength="7"  caseType="lower" nome="Matricula Inspetor" value="" insertMode="true">
                        <input type="text" name="nomeInspetor" id="nomeInspetor" class="naoEditavel" size="38" nome="Inspetor" value="" readonly>
                    </td>
                    <!--FIM INSPETOR-->
	                <!--TIPO PARARAIOS MT-->
					<th>
						NSIR Origem:
					</th>
					<td>
						<input type="text" name="TxtIdnsmanutpai" id="TxtIdnsmanutpai" size="12" maxlength="10" mask="number" promptChar=" " insertMode="true"  value="" class="editavel">
					</td>
					<!--FIM TIPO PARARAIOS MT-->
                </tr>
                <tr>
                    <!--INFORMAÇOES-->
                    <th>Outras Informações</th>
                    <td colspan="5" style="width:100%">
                        <textarea cols="50" rows="3" name="infComplementares" id="infComplementares"  caseType="upper" maxlength="255" class='editavel' style="width:340px;"></textarea>
                    </td>
                    <!--FIM INFORMAÇOES-->
                    <td colspan="6">
                        <table align="center">
                            <tr>
                                <!--ENCABEÇAMENTO-->
                                <td>
                                    <fieldset>
                                        <legend style="color:#505050"><b>Encabeçamento Uso Mútuo</b></legend>
                                        <div style="padding:5px;align-text:center;">
                                            <input type='checkbox' name='encabecamento' id='encabecamento' class='checkEditavel' value='DA' tabIndex='58'>Dados&nbsp;&nbsp;&nbsp;
<input type='checkbox' name='encabecamento' id='encabecamento' class='checkEditavel' value='TV' tabIndex='59'>TV&nbsp;&nbsp;&nbsp;
<input type='checkbox' name='encabecamento' id='encabecamento' class='checkEditavel' value='TE' tabIndex='60'>Telefone&nbsp;&nbsp;&nbsp;

                                        </div>
                                    </fieldset>
                                </td>
                                <!--FIM ENCABEÇAMENTO-->
                                <td style="width:10%"><td>
                                    <!--TANGENTE-->
                                <td>
                                    <fieldset>
                                        <legend style="color:#505050"><b>Tangente Uso Mútuo</b></legend>
                                        <div style="padding:5px;align-text:center;">
                                            <input type='checkbox' name='tangente' id='tangente' class='checkEditavel' value='DA' tabIndex='61'>Dados&nbsp;&nbsp;&nbsp;
<input type='checkbox' name='tangente' id='tangente' class='checkEditavel' value='TV' tabIndex='62'>TV&nbsp;&nbsp;&nbsp;
<input type='checkbox' name='tangente' id='tangente' class='checkEditavel' value='TE' tabIndex='63'>Telefone&nbsp;&nbsp;&nbsp;

                                        </div>
                                    </fieldset>
                                </td>
                                <!--TANGENTE-->
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                	<th>Anexo:</th>
                	<td colspan=10>
                	
    				<input type="file" name="Arq1" id="Arq1" size="50" class="CampoTexto1" >
    				
    				</td>
                </tr>
                <tr>
                    <!--SERVIÇOS-->
                    <td colspan="12">
                        <table width="100%">
                            <tr>
                                <td>
                                    <fieldset>
                                        <legend style="color:#505050"><b>Serviços</b></legend>
                                        <table width="100%" class="TabelaForm" style="border:0px;">
                                            <tr >
                                                <th>Código:</th>
                                                <td>
                                                    <select id="selCodServico" name="selCodServico" Class="comboEditavelObrig">
                                                        <option value=""></option>
                                                        <option value='1'>1</option><option value='2'>2</option><option value='3'>3</option><option value='4'>4</option><option value='5'>5</option><option value='6'>6</option><option value='7'>7</option><option value='8'>8</option><option value='9'>9</option><option value='10'>10</option><option value='11'>11</option><option value='12'>12</option><option value='13'>13</option><option value='14'>14</option><option value='15'>15</option><option value='16'>16</option><option value='17'>17</option><option value='18'>18</option><option value='19'>19</option><option value='20'>20</option><option value='21'>21</option><option value='22'>22</option><option value='23'>23</option><option value='24'>24</option><option value='25'>25</option><option value='26'>26</option><option value='27'>27</option><option value='28'>28</option><option value='30'>30</option><option value='31'>31</option><option value='32'>32</option><option value='33'>33</option><option value='34'>34</option><option value='35'>35</option><option value='36'>36</option><option value='37'>37</option><option value='38'>38</option><option value='39'>39</option><option value='40'>40</option><option value='41'>41</option><option value='42'>42</option><option value='43'>43</option><option value='44'>44</option><option value='45'>45</option><option value='46'>46</option><option value='47'>47</option><option value='48'>48</option><option value='49'>49</option><option value='50'>50</option><option value='51'>51</option><option value='52'>52</option><option value='53'>53</option><option value='54'>54</option><option value='55'>55</option><option value='56'>56</option><option value='57'>57</option><option value='58'>58</option><option value='59'>59</option><option value='61'>61</option><option value='63'>63</option><option value='64'>64</option><option value='65'>65</option><option value='66'>66</option><option value='67'>67</option><option value='68'>68</option><option value='69'>69</option><option value='70'>70</option><option value='71'>71</option><option value='72'>72</option><option value='73'>73</option><option value='74'>74</option><option value='75'>75</option><option value='76'>76</option><option value='77'>77</option><option value='78'>78</option><option value='79'>79</option><option value='80'>80</option><option value='81'>81</option><option value='82'>82</option><option value='83'>83</option><option value='84'>84</option><option value='85'>85</option><option value='86'>86</option><option value='87'>87</option><option value='88'>88</option><option value='89'>89</option><option value='90'>90</option><option value='91'>91</option><option value='92'>92</option><option value='93'>93</option><option value='94'>94</option><option value='95'>95</option><option value='96'>96</option><option value='97'>97</option><option value='98'>98</option><option value='99'>99</option><option value='100'>100</option><option value='101'>101</option><option value='102'>102</option><option value='103'>103</option><option value='104'>104</option><option value='105'>105</option><option value='106'>106</option><option value='107'>107</option><option value='108'>108</option><option value='109'>109</option><option value='110'>110</option><option value='111'>111</option><option value='112'>112</option><option value='113'>113</option><option value='114'>114</option><option value='115'>115</option><option value='116'>116</option><option value='117'>117</option><option value='118'>118</option><option value='119'>119</option><option value='120'>120</option><option value='121'>121</option><option value='122'>122</option><option value='123'>123</option><option value='124'>124</option><option value='125'>125</option><option value='126'>126</option><option value='127'>127</option><option value='128'>128</option><option value='129'>129</option><option value='130'>130</option><option value='131'>131</option><option value='132'>132</option><option value='133'>133</option><option value='134'>134</option><option value='135'>135</option><option value='136'>136</option><option value='137'>137</option><option value='138'>138</option><option value='139'>139</option><option value='140'>140</option><option value='141'>141</option><option value='142'>142</option><option value='143'>143</option><option value='144'>144</option><option value='145'>145</option><option value='146'>146</option><option value='147'>147</option><option value='148'>148</option><option value='149'>149</option><option value='150'>150</option><option value='151'>151</option><option value='152'>152</option><option value='153'>153</option><option value='154'>154</option><option value='155'>155</option><option value='156'>156</option><option value='157'>157</option><option value='158'>158</option><option value='159'>159</option><option value='160'>160</option><option value='161'>161</option><option value='162'>162</option><option value='163'>163</option><option value='164'>164</option><option value='165'>165</option><option value='166'>166</option><option value='167'>167</option><option value='168'>168</option><option value='169'>169</option><option value='170'>170</option><option value='171'>171</option><option value='172'>172</option><option value='173'>173</option><option value='174'>174</option><option value='175'>175</option><option value='176'>176</option><option value='177'>177</option><option value='178'>178</option><option value='179'>179</option><option value='180'>180</option><option value='181'>181</option><option value='182'>182</option><option value='183'>183</option><option value='184'>184</option><option value='185'>185</option><option value='186'>186</option><option value='187'>187</option><option value='188'>188</option><option value='189'>189</option><option value='190'>190</option><option value='191'>191</option><option value='192'>192</option><option value='193'>193</option><option value='194'>194</option><option value='195'>195</option><option value='196'>196</option><option value='197'>197</option><option value='198'>198</option><option value='199'>199</option><option value='200'>200</option><option value='201'>201</option><option value='202'>202</option><option value='203'>203</option><option value='204'>204</option><option value='205'>205</option><option value='206'>206</option><option value='207'>207</option><option value='208'>208</option><option value='209'>209</option><option value='210'>210</option><option value='211'>211</option><option value='212'>212</option><option value='213'>213</option><option value='214'>214</option><option value='215'>215</option><option value='216'>216</option><option value='217'>217</option><option value='218'>218</option><option value='219'>219</option><option value='220'>220</option><option value='221'>221</option><option value='222'>222</option><option value='223'>223</option><option value='225'>225</option><option value='226'>226</option><option value='227'>227</option><option value='228'>228</option><option value='229'>229</option><option value='230'>230</option><option value='231'>231</option><option value='232'>232</option><option value='233'>233</option><option value='234'>234</option><option value='235'>235</option><option value='236'>236</option><option value='237'>237</option><option value='238'>238</option><option value='239'>239</option><option value='240'>240</option><option value='241'>241</option><option value='242'>242</option><option value='243'>243</option><option value='244'>244</option><option value='245'>245</option><option value='246'>246</option><option value='247'>247</option><option value='248'>248</option><option value='249'>249</option><option value='250'>250</option><option value='251'>251</option><option value='252'>252</option><option value='253'>253</option><option value='254'>254</option><option value='255'>255</option><option value='256'>256</option><option value='257'>257</option><option value='258'>258</option><option value='259'>259</option><option value='260'>260</option><option value='261'>261</option><option value='262'>262</option><option value='263'>263</option><option value='264'>264</option><option value='265'>265</option><option value='266'>266</option><option value='267'>267</option><option value='268'>268</option><option value='269'>269</option><option value='270'>270</option><option value='271'>271</option><option value='272'>272</option><option value='273'>273</option><option value='274'>274</option><option value='275'>275</option><option value='276'>276</option><option value='277'>277</option><option value='278'>278</option><option value='279'>279</option><option value='280'>280</option><option value='281'>281</option><option value='282'>282</option><option value='283'>283</option><option value='284'>284</option><option value='285'>285</option><option value='286'>286</option><option value='287'>287</option><option value='288'>288</option><option value='289'>289</option><option value='290'>290</option><option value='291'>291</option><option value='295'>295</option><option value='296'>296</option><option value='297'>297</option><option value='298'>298</option><option value='299'>299</option><option value='300'>300</option><option value='301'>301</option><option value='302'>302</option><option value='303'>303</option><option value='304'>304</option><option value='305'>305</option><option value='306'>306</option><option value='307'>307</option><option value='308'>308</option><option value='309'>309</option><option value='310'>310</option><option value='311'>311</option><option value='312'>312</option><option value='313'>313</option><option value='314'>314</option><option value='315'>315</option><option value='316'>316</option><option value='317'>317</option><option value='318'>318</option><option value='319'>319</option><option value='320'>320</option><option value='321'>321</option><option value='322'>322</option><option value='323'>323</option><option value='324'>324</option><option value='325'>325</option><option value='328'>328</option><option value='350'>350</option><option value='351'>351</option><option value='400'>400</option><option value='410'>410</option><option value='500'>500</option><option value='1001'>1001</option><option value='1002'>1002</option><option value='1003'>1003</option><option value='1004'>1004</option><option value='1005'>1005</option><option value='1006'>1006</option><option value='1007'>1007</option><option value='1008'>1008</option><option value='1009'>1009</option><option value='1010'>1010</option><option value='1011'>1011</option><option value='1012'>1012</option><option value='1013'>1013</option><option value='1014'>1014</option><option value='1015'>1015</option><option value='1016'>1016</option><option value='1017'>1017</option><option value='1018'>1018</option><option value='1019'>1019</option><option value='1020'>1020</option><option value='1021'>1021</option><option value='1022'>1022</option><option value='1023'>1023</option><option value='1024'>1024</option><option value='1025'>1025</option><option value='1026'>1026</option><option value='1027'>1027</option><option value='1028'>1028</option><option value='1029'>1029</option><option value='1030'>1030</option><option value='1031'>1031</option><option value='1032'>1032</option><option value='1033'>1033</option><option value='1034'>1034</option><option value='1035'>1035</option><option value='1036'>1036</option><option value='1037'>1037</option><option value='1038'>1038</option><option value='1039'>1039</option><option value='1040'>1040</option><option value='1041'>1041</option><option value='1042'>1042</option><option value='1043'>1043</option><option value='1044'>1044</option><option value='1045'>1045</option><option value='1046'>1046</option><option value='1047'>1047</option><option value='1048'>1048</option><option value='1049'>1049</option><option value='1050'>1050</option><option value='1051'>1051</option><option value='1052'>1052</option><option value='1053'>1053</option><option value='1054'>1054</option><option value='1055'>1055</option><option value='1056'>1056</option><option value='1057'>1057</option><option value='1058'>1058</option><option value='1059'>1059</option><option value='1060'>1060</option><option value='1061'>1061</option><option value='1062'>1062</option><option value='1063'>1063</option><option value='1064'>1064</option><option value='1065'>1065</option><option value='1066'>1066</option><option value='1067'>1067</option><option value='1068'>1068</option><option value='1069'>1069</option><option value='1070'>1070</option><option value='1071'>1071</option><option value='1072'>1072</option><option value='1073'>1073</option><option value='1074'>1074</option><option value='1075'>1075</option><option value='1076'>1076</option><option value='1077'>1077</option><option value='1078'>1078</option><option value='1079'>1079</option><option value='1080'>1080</option><option value='1081'>1081</option><option value='1082'>1082</option><option value='1083'>1083</option><option value='1084'>1084</option><option value='1085'>1085</option><option value='1086'>1086</option><option value='1087'>1087</option><option value='1088'>1088</option><option value='1089'>1089</option><option value='1090'>1090</option><option value='1091'>1091</option><option value='1092'>1092</option><option value='1093'>1093</option><option value='1094'>1094</option><option value='1095'>1095</option><option value='1096'>1096</option><option value='1097'>1097</option><option value='1098'>1098</option><option value='1099'>1099</option><option value='1100'>1100</option><option value='1101'>1101</option><option value='1102'>1102</option><option value='1103'>1103</option><option value='1104'>1104</option><option value='1105'>1105</option><option value='1106'>1106</option><option value='1107'>1107</option><option value='1108'>1108</option><option value='1109'>1109</option><option value='1110'>1110</option><option value='1111'>1111</option><option value='1112'>1112</option><option value='1113'>1113</option><option value='1114'>1114</option><option value='1115'>1115</option><option value='1116'>1116</option><option value='1117'>1117</option><option value='1118'>1118</option><option value='1119'>1119</option><option value='1120'>1120</option><option value='1121'>1121</option><option value='1122'>1122</option><option value='1123'>1123</option><option value='1124'>1124</option><option value='1125'>1125</option><option value='1126'>1126</option><option value='1127'>1127</option><option value='1128'>1128</option><option value='1129'>1129</option><option value='1130'>1130</option><option value='1131'>1131</option><option value='1132'>1132</option><option value='1133'>1133</option><option value='1134'>1134</option><option value='1135'>1135</option><option value='1136'>1136</option><option value='1137'>1137</option><option value='1138'>1138</option><option value='1139'>1139</option><option value='1140'>1140</option><option value='1141'>1141</option><option value='1142'>1142</option><option value='1143'>1143</option><option value='1144'>1144</option><option value='1145'>1145</option><option value='1146'>1146</option><option value='1147'>1147</option><option value='1148'>1148</option><option value='1149'>1149</option><option value='1150'>1150</option><option value='1151'>1151</option><option value='1152'>1152</option><option value='1153'>1153</option><option value='1154'>1154</option><option value='1155'>1155</option><option value='1156'>1156</option><option value='1157'>1157</option><option value='1158'>1158</option><option value='1159'>1159</option><option value='1160'>1160</option><option value='1161'>1161</option><option value='1162'>1162</option><option value='1163'>1163</option><option value='1164'>1164</option><option value='1165'>1165</option><option value='1166'>1166</option><option value='1167'>1167</option><option value='1168'>1168</option><option value='1169'>1169</option><option value='1170'>1170</option><option value='1171'>1171</option><option value='1172'>1172</option><option value='1173'>1173</option><option value='1174'>1174</option><option value='1175'>1175</option><option value='1176'>1176</option><option value='1177'>1177</option><option value='1178'>1178</option><option value='1179'>1179</option><option value='1180'>1180</option><option value='1181'>1181</option><option value='1182'>1182</option><option value='1183'>1183</option><option value='1184'>1184</option><option value='1185'>1185</option><option value='1186'>1186</option><option value='1187'>1187</option><option value='1188'>1188</option><option value='1189'>1189</option><option value='1190'>1190</option><option value='1191'>1191</option><option value='1192'>1192</option><option value='1193'>1193</option><option value='1194'>1194</option><option value='1195'>1195</option><option value='1196'>1196</option><option value='1197'>1197</option><option value='1198'>1198</option><option value='1199'>1199</option><option value='1200'>1200</option><option value='1201'>1201</option><option value='1202'>1202</option><option value='1203'>1203</option><option value='1204'>1204</option><option value='1205'>1205</option><option value='1206'>1206</option><option value='1207'>1207</option><option value='1208'>1208</option><option value='1209'>1209</option><option value='1210'>1210</option><option value='1211'>1211</option><option value='2200'>2200</option><option value='2201'>2201</option><option value='2202'>2202</option><option value='2203'>2203</option><option value='2204'>2204</option><option value='2205'>2205</option><option value='2206'>2206</option><option value='2207'>2207</option><option value='2208'>2208</option><option value='2209'>2209</option><option value='2210'>2210</option><option value='2211'>2211</option><option value='2212'>2212</option><option value='2213'>2213</option><option value='2214'>2214</option><option value='2215'>2215</option><option value='2216'>2216</option><option value='2217'>2217</option><option value='2218'>2218</option><option value='2219'>2219</option><option value='2220'>2220</option><option value='2221'>2221</option><option value='2222'>2222</option><option value='2223'>2223</option><option value='2224'>2224</option><option value='2225'>2225</option><option value='2226'>2226</option><option value='2227'>2227</option><option value='2228'>2228</option><option value='2229'>2229</option><option value='2230'>2230</option><option value='2231'>2231</option><option value='2232'>2232</option><option value='2234'>2234</option><option value='2235'>2235</option><option value='2236'>2236</option><option value='2237'>2237</option><option value='2238'>2238</option><option value='2239'>2239</option><option value='2240'>2240</option><option value='2241'>2241</option><option value='2242'>2242</option><option value='2243'>2243</option><option value='2244'>2244</option><option value='2245'>2245</option><option value='2246'>2246</option><option value='2247'>2247</option><option value='2290'>2290</option><option value='2291'>2291</option><option value='2292'>2292</option><option value='2293'>2293</option><option value='3824'>3824</option><option value='4151'>4151</option><option value='700001'>700001</option><option value='700002'>700002</option><option value='700003'>700003</option><option value='700004'>700004</option><option value='700005'>700005</option><option value='700006'>700006</option><option value='700007'>700007</option><option value='700008'>700008</option><option value='700009'>700009</option><option value='700010'>700010</option><option value='700011'>700011</option><option value='700012'>700012</option><option value='700013'>700013</option><option value='700014'>700014</option><option value='700015'>700015</option><option value='700016'>700016</option><option value='700017'>700017</option><option value='700018'>700018</option><option value='700019'>700019</option><option value='700020'>700020</option><option value='700021'>700021</option><option value='700022'>700022</option><option value='700023'>700023</option><option value='700024'>700024</option><option value='700025'>700025</option><option value='700026'>700026</option><option value='700027'>700027</option><option value='700028'>700028</option><option value='700029'>700029</option><option value='700030'>700030</option><option value='700031'>700031</option><option value='700032'>700032</option><option value='700033'>700033</option><option value='700034'>700034</option><option value='700035'>700035</option><option value='700036'>700036</option><option value='700037'>700037</option><option value='700038'>700038</option><option value='700039'>700039</option><option value='700040'>700040</option><option value='700041'>700041</option><option value='700042'>700042</option><option value='700043'>700043</option><option value='700044'>700044</option><option value='700045'>700045</option><option value='700046'>700046</option><option value='700047'>700047</option><option value='700048'>700048</option><option value='700049'>700049</option><option value='700050'>700050</option><option value='700051'>700051</option><option value='700052'>700052</option><option value='700053'>700053</option><option value='700054'>700054</option><option value='700055'>700055</option><option value='700056'>700056</option><option value='700057'>700057</option><option value='700058'>700058</option><option value='700059'>700059</option><option value='700060'>700060</option><option value='700061'>700061</option><option value='700062'>700062</option><option value='700063'>700063</option><option value='700064'>700064</option><option value='700065'>700065</option><option value='700066'>700066</option><option value='700067'>700067</option><option value='700068'>700068</option><option value='700069'>700069</option><option value='700070'>700070</option><option value='700071'>700071</option><option value='700072'>700072</option><option value='700073'>700073</option><option value='700074'>700074</option><option value='700075'>700075</option><option value='700076'>700076</option><option value='700077'>700077</option><option value='700078'>700078</option><option value='700079'>700079</option><option value='700080'>700080</option><option value='700081'>700081</option><option value='700082'>700082</option><option value='700083'>700083</option><option value='700084'>700084</option><option value='700085'>700085</option><option value='700086'>700086</option><option value='700087'>700087</option><option value='700088'>700088</option><option value='700089'>700089</option><option value='700090'>700090</option><option value='700091'>700091</option><option value='700092'>700092</option><option value='700093'>700093</option><option value='700094'>700094</option><option value='700095'>700095</option><option value='700096'>700096</option><option value='700097'>700097</option><option value='700098'>700098</option><option value='700099'>700099</option><option value='700100'>700100</option><option value='700101'>700101</option><option value='700102'>700102</option><option value='700103'>700103</option><option value='700104'>700104</option><option value='700105'>700105</option><option value='700106'>700106</option><option value='700107'>700107</option><option value='700108'>700108</option><option value='700109'>700109</option><option value='700110'>700110</option><option value='700111'>700111</option><option value='700112'>700112</option><option value='700113'>700113</option><option value='700114'>700114</option><option value='700115'>700115</option><option value='700116'>700116</option><option value='700117'>700117</option><option value='700118'>700118</option><option value='700119'>700119</option><option value='700120'>700120</option><option value='700121'>700121</option><option value='700122'>700122</option><option value='700123'>700123</option><option value='700124'>700124</option><option value='700125'>700125</option><option value='700126'>700126</option><option value='700127'>700127</option><option value='700128'>700128</option><option value='700129'>700129</option><option value='700130'>700130</option><option value='700131'>700131</option><option value='700132'>700132</option><option value='700133'>700133</option><option value='700134'>700134</option><option value='700135'>700135</option><option value='700136'>700136</option><option value='700137'>700137</option><option value='700138'>700138</option><option value='700139'>700139</option><option value='700140'>700140</option><option value='700141'>700141</option><option value='700142'>700142</option><option value='700143'>700143</option><option value='700144'>700144</option><option value='700145'>700145</option><option value='700146'>700146</option><option value='700147'>700147</option><option value='700148'>700148</option><option value='700149'>700149</option><option value='700150'>700150</option><option value='700151'>700151</option><option value='700152'>700152</option><option value='700153'>700153</option><option value='700154'>700154</option><option value='700155'>700155</option><option value='700156'>700156</option><option value='700157'>700157</option><option value='700158'>700158</option><option value='700159'>700159</option><option value='700160'>700160</option><option value='700161'>700161</option><option value='700162'>700162</option><option value='700163'>700163</option><option value='700164'>700164</option><option value='702817'>702817</option><option value='703461'>703461</option><option value='703994'>703994</option><option value='703995'>703995</option><option value='703996'>703996</option><option value='703997'>703997</option><option value='703998'>703998</option><option value='703999'>703999</option><option value='704000'>704000</option><option value='704001'>704001</option><option value='704002'>704002</option><option value='704003'>704003</option><option value='704004'>704004</option><option value='704005'>704005</option><option value='704006'>704006</option><option value='704007'>704007</option><option value='704008'>704008</option><option value='704009'>704009</option><option value='704010'>704010</option><option value='704011'>704011</option><option value='704012'>704012</option><option value='704013'>704013</option><option value='704014'>704014</option><option value='704015'>704015</option><option value='704016'>704016</option><option value='704017'>704017</option><option value='704018'>704018</option><option value='704019'>704019</option><option value='704020'>704020</option><option value='704021'>704021</option><option value='704022'>704022</option><option value='704023'>704023</option><option value='704024'>704024</option><option value='704025'>704025</option><option value='704026'>704026</option><option value='704027'>704027</option><option value='704028'>704028</option><option value='704029'>704029</option><option value='704030'>704030</option><option value='704031'>704031</option><option value='704032'>704032</option><option value='704033'>704033</option><option value='704034'>704034</option><option value='704035'>704035</option><option value='704036'>704036</option><option value='704037'>704037</option><option value='704038'>704038</option><option value='704039'>704039</option><option value='704040'>704040</option><option value='704041'>704041</option><option value='704042'>704042</option><option value='704043'>704043</option><option value='704044'>704044</option><option value='704045'>704045</option><option value='704046'>704046</option><option value='704047'>704047</option><option value='704048'>704048</option><option value='704049'>704049</option><option value='704050'>704050</option><option value='704051'>704051</option><option value='704052'>704052</option><option value='704053'>704053</option><option value='704054'>704054</option><option value='704055'>704055</option><option value='704056'>704056</option><option value='704057'>704057</option><option value='704058'>704058</option><option value='704059'>704059</option><option value='704060'>704060</option><option value='704061'>704061</option><option value='704062'>704062</option><option value='704063'>704063</option><option value='704064'>704064</option><option value='704065'>704065</option><option value='704066'>704066</option><option value='704067'>704067</option><option value='704068'>704068</option><option value='704069'>704069</option><option value='704070'>704070</option><option value='704071'>704071</option><option value='704072'>704072</option><option value='704073'>704073</option><option value='704074'>704074</option><option value='704075'>704075</option><option value='704076'>704076</option><option value='704077'>704077</option><option value='704078'>704078</option><option value='704079'>704079</option><option value='704080'>704080</option><option value='704081'>704081</option><option value='704082'>704082</option><option value='704083'>704083</option><option value='704084'>704084</option><option value='704085'>704085</option><option value='704086'>704086</option><option value='704087'>704087</option><option value='704088'>704088</option><option value='704089'>704089</option><option value='704090'>704090</option><option value='704091'>704091</option><option value='704092'>704092</option><option value='704093'>704093</option><option value='704094'>704094</option><option value='704095'>704095</option><option value='704096'>704096</option><option value='704097'>704097</option><option value='704098'>704098</option><option value='704099'>704099</option><option value='704100'>704100</option><option value='704101'>704101</option><option value='704102'>704102</option><option value='704103'>704103</option><option value='704104'>704104</option><option value='704105'>704105</option><option value='704106'>704106</option><option value='704107'>704107</option><option value='704108'>704108</option><option value='704109'>704109</option><option value='704110'>704110</option><option value='704111'>704111</option><option value='704112'>704112</option><option value='704113'>704113</option><option value='704114'>704114</option><option value='704115'>704115</option><option value='704116'>704116</option><option value='704117'>704117</option><option value='704118'>704118</option><option value='704119'>704119</option><option value='704120'>704120</option><option value='704121'>704121</option><option value='704122'>704122</option><option value='704123'>704123</option><option value='704124'>704124</option><option value='704125'>704125</option><option value='704126'>704126</option><option value='704127'>704127</option><option value='704128'>704128</option><option value='704129'>704129</option><option value='704130'>704130</option><option value='704131'>704131</option><option value='704132'>704132</option><option value='704133'>704133</option><option value='704134'>704134</option><option value='704135'>704135</option><option value='704136'>704136</option><option value='704137'>704137</option><option value='704138'>704138</option><option value='704139'>704139</option><option value='704140'>704140</option><option value='704141'>704141</option><option value='704142'>704142</option><option value='704143'>704143</option><option value='704144'>704144</option><option value='704145'>704145</option><option value='704146'>704146</option><option value='704147'>704147</option><option value='704148'>704148</option>
                                                    </select>
                                                </td>
                                                <th>Descrição:</th>
                                                <td style="width:350px;" colspan="2">
                                                    <select id="selDescServico" name="selDescServico" Class="comboEditavelObrig" style="width:100%">
                                                        <option value=""></option>
                                                        <option value='2217'>22 21 POD FAIX FC OPERAR DISPOSIT MANOB PROT - COD</option><option value='2216'>22 21 POD FAIX FC OPERAR DISPOSIT MANOB PROT - CSC</option><option value='2218'>22 FC ALOCACAO PROFISSIONAL ATUAR COMO PREPOSTO</option><option value='704121'>ABRIR/FECHAR JUMPER SEC CIRCUITO MANUT - ABRIR/FEC</option><option value='300'>ACOPLAMENTO DE OBRAS - FSE</option><option value='322'>ADICIONAL 30 POR CENTO - ACION EMERG SOMENTE NSMC</option><option value='1'>AFASTADOR DE BT - INSTALAR - PC</option><option value='2'>AFASTADOR DE BT - SUBSTITUIR - PC</option><option value='704019'>AFASTADOR DE BT/NEUTRO MANUT - INSTALAR</option><option value='3'>AGARRA PAPAGAIO - INSTALAR - EST</option><option value='704103'>AGARRA PAPAGAIO MANUT - INSTALAR</option><option value='4'>ALCA ESTRIBO - BASE P CH FUSIVEL - INSTALAR - PC</option><option value='5'>ALCA ESTRIBO FECHADO - ATER RDP - INSTALAR - PC</option><option value='6'>AMARRACAO - SUBSTITUIR/RECOMPOR - EST</option><option value='704104'>AMARRACAO ESTRUTURA MANUT - INSTALAR/ SUBSTITUIR</option><option value='7'>ANEL ELASTOMERICO RDP - SUBSTITUIR - CJ</option><option value='313'>APOIO LV   JUMPER - SECCIONAR - EST</option><option value='308'>APOIO LV  CHAVE FACA DEFINITIVA  INSTALAR - PC</option><option value='309'>APOIO LV  CHAVE FACA DEFINITIVA  RETIRAR - PC</option><option value='304'>APOIO LV  CHAVE FACA TEMPORARIA  INSTALAR - PC</option><option value='305'>APOIO LV  CHAVE FACA TEMPORARIA  RETIRAR - PC</option><option value='310'>APOIO LV  CHAVE FUSIVEL ADAPTADA  INSTALAR - PC</option><option value='311'>APOIO LV  CHAVE FUSIVEL ADAPTADA  RETIRAR - PC</option><option value='306'>APOIO LV  CHAVE FUSIVEL TEMPORARIA - INSTALAR - PC</option><option value='307'>APOIO LV  CHAVE FUSIVEL TEMPORARIA - RETIRAR - PC</option><option value='312'>APOIO LV  JUMPER - FECHAR - FSE</option><option value='704000'>APRUMAR POSTE EXISTENTE MANUT - INSTALAR</option><option value='11'>ARVORE - MANUTENCAO - PODAR DENTRO DE VAO - UN</option><option value='10'>ARVORE - PLANTIO E FORNECIMENTO DE MUDAS - UN</option><option value='13'>ARVORE - RDU - BT - DESTINACAO FINAL- PODAR - UN</option><option value='14'>ARVORE - RDU - DESTINACAO FINAL - PODAR - UN</option><option value='8'>ARVORE - RDU - DESTOCA RECOMP PISO E DESTINAC - UN</option><option value='15'>ARVORE - RDU - MT-BT - DEST FINAL - SUPRIMIR - UN</option><option value='12'>ARVORE - RDU - RECOLHER GALHOS E DESTINACAO - UN</option><option value='295'>ATENDIMENTO EMERGENCIAL</option><option value='16'>ATERRAMENTO  (HASTE ADICIONAL) - INSTALAR - PC</option><option value='17'>ATERRAMENTO  (UMA HASTE) - INSTALAR - CJ</option><option value='704078'>ATERRAMENTO ATE 3 HASTES MANUT - INSTALAR</option><option value='18'>ATERRAMENTO DE FERRAGENS DE IP - PADRONIZAR - UN</option><option value='704080'>ATERRAR/SECCIONAR CERCA OU TELA MANUT - INSTALAR</option><option value='19'>BARRAMENTO DE TRAFO MONO - SUBSTITUIR - CJ</option><option value='20'>BARRAMENTO DE TRAFO TRIFASICO - SUBSTITUIR - CJ</option><option value='704085'>BARRAMENTO TRANSFORMADOR 1F MANUT - SUBSTITUIR</option><option value='704086'>BARRAMENTO TRANSFORMADOR 3F MANUT - SUBSTITUIR</option><option value='21'>BRACO C RDP - SUBSTITUIR - UN</option><option value='22'>BRACO DE IP  LEVE OU MEDIO - ALCAR - EST</option><option value='23'>BRACO DE IP  LEVE OU MEDIO - GIRAR - EST</option><option value='24'>BRACO DE IP  LEVE OU MEDIO - REBAIXAR - PC</option><option value='25'>BRACO DE IP CURTO - SUBSTITUIR - PC</option><option value='26'>BRACO DE IP MEDIO - REINSTALAR - PC</option><option value='27'>BRACO DE IP MEDIO - SUBSTITUIR - PC</option><option value='28'>BRACO DE IP PESADO - ALCAR - EST</option><option value='30'>BRACO DE IP PESADO - REBAIXAR - EST</option><option value='31'>BRACO DE IP PESADO - SUBSTITUIR - PC</option><option value='32'>BRACO J RDP CABO 50-150 - INSTALAR - UN</option><option value='33'>BRACO J RDP CABO 50-150 - SUBSTITUIR - UN</option><option value='34'>BRACO L RDP - SUBSTITUIR - UN</option><option value='35'>BRACO SUPORTE  GRAMPO EM BT - SUBSTITUIR - UN</option><option value='704020'>BRACO SUPORTE BT (GPO) MANUT - SUBSTITUIR</option><option value='36'>BRACO SUPORTE GRAMPO MT (RDI) - SUBSTITUIR - UN</option><option value='704018'>BRACO SUPORTE MT ISOLADA MANUT - SUBSTITUIR</option><option value='704017'>BRACO SUPORTE MT PROTEGIDA MANUT - SUBSTITUIR</option><option value='37'>CABO ACO, MENSAGEIRO - EMENDAR - VAO</option><option value='38'>CABO BT - CALIBRAR - VAO</option><option value='39'>CABO BT - CONVENCIONAL - EMENDAR - PC</option><option value='40'>CABO BT - CONVENCIONAL - INSTALAR - VAO</option><option value='41'>CABO BT - CONVENCIONAL - SUBSTITUIR - VAO</option><option value='42'>CABO BT - INTERLIGACAO - RETIRAR - EST</option><option value='43'>CABO BT - RDS - INSTALAR - VAO</option><option value='44'>CABO BT - RDS - RETIRAR - VAO</option><option value='45'>CABO BT - RDS - SUBSTITUIR - VAO</option><option value='46'>CABO BT - RECOMPOR - FSE</option><option value='47'>CABO BT - RSI - EMENDAR - FSE</option><option value='48'>CABO BT - RSI - INSTALAR - VAO</option><option value='49'>CABO BT - RSI - SUBSTITUIR - VAO</option><option value='50'>CABO BT MONO - P PODA - RETIRAR E INSTALAR - VAO</option><option value='51'>CABO BT OU MT - CONV.-RSI - RETIRAR - VAO</option><option value='52'>CABO BT TRIF P PODA - RETIRAR E INSTALAR - VAO</option><option value='704033'>CABO DE ACO MENSAGEIRO MANUT - EMENDAR/CALIBRAR</option><option value='53'>CABO MT - RDS - INSTALAR - VAO</option><option value='54'>CABO MT - RDS - RETIRAR - VAO</option><option value='55'>CABO MT - RDS - SUBSTITUIR - VAO</option><option value='57'>CABO MT 4 - 1-0  CAA - EMENDAR - FSE</option><option value='56'>CABO MT 4 - 1-0 AWG CA - EMENDAR - FSE</option><option value='58'>CABO MT 4-0 - 336,4 CA - EMENDAR - FSE</option><option value='59'>CABO MT 4-0 - 336,4 CAA - EMENDAR - FSE</option><option value='704034'>CABO MT CA <=1/0 / RDP <=50MM² MANUT - EMENDAR/CAL</option><option value='704036'>CABO MT CA >=4/0 / RDP >=150MM² MANUT - EMENDAR/CA</option><option value='704035'>CABO MT CAA <=1/0 MANUT - EMENDAR/CALIBRAR</option><option value='704037'>CABO MT CAA >1/0 MANUT - EMENDAR/CALIBRAR</option><option value='61'>CABO MT E BT MONO (PODA) - RETIRAR-INSTALAR - VAO</option><option value='63'>CABO MT E BT TRIF (PPODA) - RETIRAR-INSTALAR - VAO</option><option value='64'>CABO MT ISOLADO - EMENDAR - FSE</option><option value='65'>CABO MT ISOLADO - SUBSTITUIR - VAO</option><option value='704038'>CABO MT ISOLADO MANUT - EMENDAR/CALIBRAR</option><option value='66'>CABO MT MONO - INSTALAR - VAO</option><option value='67'>CABO MT MONO - SUBSTITUIR - VAO</option><option value='68'>CABO MT RDR MONO - CALIBRAR - VAO</option><option value='69'>CABO MT RDR TRIF - CALIBRAR - VAO</option><option value='70'>CABO MT RDU - CALIBRAR - VAO</option><option value='72'>CABO MT TRIF. - INSTALAR - VAO</option><option value='71'>CABO MT TRIF. - SUBSTITUIR - VAO</option><option value='704041'>CABO NEUTRO MANUT - INSTALAR</option><option value='704042'>CABO NEUTRO MANUT - RETIRAR</option><option value='73'>CABO NEUTRO RDR - REINSTALAR - VAO</option><option value='74'>CABO NEUTRO RDR - SUBSTITUIR - VAO</option><option value='75'>CABO NEUTRO RDU - REINSTALAR - VAO</option><option value='76'>CABO NEUTRO RDU - SUBSTITUIR - VAO</option><option value='77'>CABO RDP 50-150 - EMENDAR E RECOMPOR PROTECAO -FSE</option><option value='704039'>CABOS BT CONVENCIONAL/ISOLADA MANUT - INSTALAR</option><option value='704040'>CABOS BT CONVENCIONAL/ISOLADA MANUT - RETIRAR</option><option value='704043'>CABOS BT SUBTERRANEA MANUT - INSTALAR</option><option value='704044'>CABOS BT SUBTERRANEA MANUT - RETIRAR</option><option value='704025'>CABOS MT CONV TODOS OU RDP <=150 3F - INSTALAR</option><option value='704026'>CABOS MT CONV TODOS OU RDP <=150 3F - RETIRAR</option><option value='704023'>CABOS MT CONV/PROTEGIDA 1F MANUT - INSTALAR</option><option value='704024'>CABOS MT CONV/PROTEGIDA 1F MANUT - RETIRAR</option><option value='704029'>CABOS MT ISOLADA MANUT - INSTALAR</option><option value='704030'>CABOS MT ISOLADA MANUT - RETIRAR</option><option value='704027'>CABOS MT PROTEGIDA >150MM2 3F - INSTALAR</option><option value='704028'>CABOS MT PROTEGIDA >150MM2 3F - RETIRAR</option><option value='704031'>CABOS MT SUBTERRANEA MANUT - INSTALAR</option><option value='704032'>CABOS MT SUBTERRANEA MANUT - RETIRAR</option><option value='78'>CAIXA DE PASSAGEM - CONCRETAR - UN</option><option value='79'>CAIXA DE PASSAGEM - CONCRETO - RETIRAR - UN</option><option value='704143'>CAIXA INSPECAO ZA MANUT - INSTALAR/ REFAZER</option><option value='704144'>CAIXA INSPECAO ZB MANUT - INSTALAR/ REFAZER</option><option value='704145'>CAIXA INSPECAO ZC MANUT - INSTALAR/ REFAZER</option><option value='704146'>CAIXA INSPECAO ZD MANUT - INSTALAR/ REFAZER</option><option value='704072'>CAPACITOR MANUT - INSTALAR</option><option value='704073'>CAPACITOR MANUT - RETIRAR</option><option value='80'>CAPACITOR MT - SUBSTITUIR - PC</option><option value='81'>CAPACITORES BANCO MONO - INSTALAR - EST</option><option value='82'>CAPACITORES BANCO TRIF. - INSTALAR - EST</option><option value='134'>CARTUCHO - SUBSTITUIR - EST</option><option value='83'>CERCA ARAME 5 FI 1 HASTE - ATERRAR E SECCIONAR-PTO</option><option value='84'>CH FACA TRIPOLAR COM ACESSORIOS - RETIRAR - EST</option><option value='89'>CH FACA UNIP MONO - C ALTER. ESTR - INSTALAR - CJ</option><option value='88'>CH FACA UNIP MONO - SEM ALTER ESTR - INSTALAR-CJ</option><option value='85'>CH FACA UNIP RDP-S PTO BYPASS - MANUTENCIONAR -FSE</option><option value='90'>CH FACA UNIP TRIF - C ALTER ESTRUT - INSTALAR - CJ</option><option value='91'>CH FACA UNIP TRIF - SEM ALT ESTRUT - INSTALAR - CJ</option><option value='86'>CH FACA UNIPOLAR - RETIRAR - PC</option><option value='87'>CH FACA UNIPOLAR - SUBSTITUIR - PC</option><option value='92'>CH FUS - RETIRAR - PC</option><option value='95'>CH FUS MONO - C ALTER ESTRUT - INSTALAR - CJ</option><option value='94'>CH FUS MONO - S ALTER ESTRUT - INSTALAR - CJ</option><option value='96'>CH FUS RDP- S PTO BYPASS - MANUTENCIONAR - FSE</option><option value='99'>CH FUS REPET MONO - C ALTER ESTRUT- INSTALAR - CJ</option><option value='98'>CH FUS REPET MONO - S ALTER ESTRUT - INSTALAR - CJ</option><option value='101'>CH FUS REPET TRIF - C ALTER ESTRUT- INSTALAR - CJ</option><option value='100'>CH FUS REPET TRIF - S ALTER ESTRUT- INSTALAR - CJ</option><option value='97'>CH FUS REPETIDORA - SUBSTITUIR - FSE</option><option value='102'>CH FUS TRIF - C ALTER ESTRUT- INSTALAR - CJ</option><option value='103'>CH FUS TRIF- S ALTER ESTRUT- INSTALAR - CJ</option><option value='93'>CH FUSIVEL - SUBSTITUIR - PC</option><option value='105'>CH TRIPOLAR - C ALTER ESTRUTURA - INSTALAR - CJ</option><option value='104'>CH TRIPOLAR - SUBSTITUIR - CJ</option><option value='704065'>CHAVE FACA ADAPTADA MANUT - INSTALAR</option><option value='704066'>CHAVE FACA ADAPTADA MANUT - RETIRAR</option><option value='704071'>CHAVE FACA BASCULANTE 3F MANUT - RETIRAR</option><option value='704063'>CHAVE FACA MANUT - INSTALAR</option><option value='704064'>CHAVE FACA MANUT - RETIRAR</option><option value='704067'>CHAVE FUSIVEL MANUT - INSTALAR</option><option value='704068'>CHAVE FUSIVEL MANUT - RETIRAR</option><option value='704069'>CHAVE REPETIDORA MANUT - INSTALAR</option><option value='704070'>CHAVE REPETIDORA MANUT - RETIRAR</option><option value='106'>CHICOTE IP C ATER FERRAGEM - SUBSTITUIR - CJ</option><option value='107'>CIPO E TREPADEIRA EM RDU - CORTAR - UN</option><option value='108'>COBERT PROTETORA BT - 4 -336,4 - INSTALAR - VAO</option><option value='109'>COBERT PROTETORA DE BUCHA BT -  INSTALAR - UN</option><option value='110'>COBERT PROTETORA DE BUCHA MT -  INSTALAR - UN</option><option value='111'>COBERT PROTETORA MT - 4-336,4 - INSTALAR - VAO</option><option value='704084'>COBERTURA PROTETORA BUCHA MT/BT MANUT - INSTALAR</option><option value='2247'>COMISSIONAR RELIG REGUL DE TENSAO CHAVE</option><option value='704142'>CONCRETAR BANCO DE DUTOS MANUT - INSTALAR</option><option value='704004'>CONCRETAR BASE POSTE 1000DAN MANUT - INSTALAR</option><option value='704002'>CONCRETAR BASE POSTE 300DAN MANUT - INSTALAR</option><option value='704003'>CONCRETAR BASE POSTE 600DAN MANUT - INSTALAR</option><option value='112'>CONEXAO - ENCAB DERIV APOIO LV - EXECUTAR - EST</option><option value='113'>CONEXAO - MANUTENCIONAR - EST</option><option value='114'>CONEXAO - SUBSTITUIR - EST</option><option value='115'>CONEXAO BT RDS - MANUTENCIONAR - EST</option><option value='116'>CONEXAO BT RDS - SUBSTITUIR - EST</option><option value='704050'>CONEXAO BT RDS MANUT - SUBSTITUIR</option><option value='704046'>CONEXAO MT ISOLADA TME/TDC/TDR MANUT - SUBSTITUIR</option><option value='117'>CONEXAO MT RDS - MANUTENCIONAR - EST</option><option value='118'>CONEXAO MT RDS - SUBSTITUIR - EST</option><option value='704047'>CONEXAO MT RDS MANUT - SUBSTITUIR</option><option value='302'>CONJ MEDICAO - INSTALAR - CJ</option><option value='303'>CONJ MEDICAO - RETIRAR - CJ</option><option value='301'>CONJ MEDICAO - SUBSTITUIR - CJ</option><option value='119'>CONTRA-POSTE - SUBSTITUIR - PC</option><option value='120'>CONTRA-POSTE COM ESTAI - INSTALAR - UN</option><option value='121'>CONTRA-POSTE COM ESTAI - RETIRAR - UN</option><option value='122'>CRUZETA - 5 OU 7M - SUBSTITUIR - PC</option><option value='123'>CRUZETA - ACESSORIO - INSPECIONAR - UN</option><option value='124'>CRUZETA - BANCADA RT - SUBSTITUIR - CJ</option><option value='125'>CRUZETA - CHS BY PASS DE RT  - SUBSTITUIR - CJ</option><option value='126'>CRUZETA - INDICE 1 OU 2 - SUBSTITUIR - PC</option><option value='127'>CRUZETA - INDICE 3 OU 4 - SUBSTITUIR - PC</option><option value='128'>CRUZETA - RDP CE-M4 - SUBSTITUIR - PC</option><option value='704015'>CRUZETA EUCALIPTO 5M MANUT - SUBSTITUIR</option><option value='704013'>CRUZETA INDICE 1 OU 2 CONV/RDP MANUT - SUBSTITUIR</option><option value='704014'>CRUZETA INDICE 3 OU 4 CONV/RDP MANUT - SUBSTITUIR</option><option value='704147'>DESCIDA DE POSTE ELETRODUTOS/CABOS - INSTALAR</option><option value='704148'>DESCIDA DE POSTE ELETRODUTOS/CABOS - RETIRAR</option><option value='129'>DESCONECTAVEL DE RDI - SUBSTITUIR - PC</option><option value='704048'>DESCONECTAVEL DE RDI MANUT - SUBSTITUIR</option><option value='130'>DESCONECTAVEL DE RDS - SUBSTITUIR - PC</option><option value='704049'>DESCONECTAVEL DE RDS MANUT - SUBSTITUIR</option><option value='321'>DESLOCAMENTO KM LINEAR - VER FATOR CONTRATO - M</option><option value='131'>DISJUNTOR DE BT - RETIRAR - UN</option><option value='132'>DISPOSITIVO - OPERAR - UN</option><option value='133'>ELO FUSIVEL - SUBSTITUIR - EST</option><option value='704094'>ELO FUSIVEL/CART/LAM C/ BY-PASS MANUT - SUBSTITUIR</option><option value='704093'>ELO FUSIVEL/CARTUCHO/LAMINA MANUT - SUBSTITUIR</option><option value='704045'>EMENDAR/CALIBRAR CABOS BT CONV/ISOLADA MANUT - EME</option><option value='146'>EQUIP LEITURA EVENTOS -  COLHER - UN</option><option value='142'>EQUIP RE1000  EM AREA URBANA - INSTALAR - UN</option><option value='143'>EQUIP RE1000  EM AREA URBANA - RETIRAR - UN</option><option value='144'>EQUIP RE1000 EM AREA RURAL - INSTALAR - UN</option><option value='145'>EQUIP RE1000 EM AREA RURAL - RETIRAR - UN</option><option value='136'>EQUIPAMENTO - INSPECIONAR - UN</option><option value='137'>EQUIPAMENTO IMS EM AREA RURAL - INSTALAR - UN</option><option value='138'>EQUIPAMENTO IMS EM AREA RURAL - RETIRAR - UN</option><option value='139'>EQUIPAMENTO IMS EM AREA URBANA - INSTALAR - UN</option><option value='140'>EQUIPAMENTO IMS EM AREA URBANA - RETIRAR - UN</option><option value='704097'>EQUIPAMENTO MEDICAO BT MANUT - INSTALAR</option><option value='704098'>EQUIPAMENTO MEDICAO BT MANUT - RETIRAR</option><option value='704095'>EQUIPAMENTO MEDICAO MT MANUT - INSTALAR</option><option value='704096'>EQUIPAMENTO MEDICAO MT MANUT - RETIRAR</option><option value='141'>EQUIPAMENTO NUMERAR - PINTAR - PC</option><option value='704001'>ESCORAR POSTE MANUT - INSTALAR</option><option value='147'>ESPACADOR BT (ATE 5 PECAS)- INSTALAR - VAO</option><option value='704089'>ESPACADOR BT MANUT - INSTALAR</option><option value='148'>ESPACADOR LOSANGULAR RDP - SUBSTITUIR - PC</option><option value='149'>ESPACADOR MONOFASICO RDP - SUBSTITUIR - PC</option><option value='150'>ESPACADOR MT - INSTALAR - VAO</option><option value='704088'>ESPACADOR MT MANUT - INSTALAR</option><option value='154'>ESTAI  CZ A POSTE - INSTALAR - EST</option><option value='151'>ESTAI - TENSIONAR-SUBSTITUIR - PC</option><option value='704082'>ESTAI ANCORA MANUT - INSTALAR</option><option value='152'>ESTAI CZ A CZ - INSTALAR - EST</option><option value='155'>ESTAI DE ANCORA - INSTALAR - EST</option><option value='704081'>ESTAI MANUT - INSTALAR</option><option value='153'>ESTAI POSTE A POSTE - INSTALAR - EST</option><option value='704083'>ESTAI TENSIONAR MANUT - TENSIONAR</option><option value='158'>ESTRUT IND 1 MONO - IND. 2, 3, 4 - MODIFICAR - EST</option><option value='704021'>ESTRUTURA BT CONVENCIONAL/ISOLADA - INSTALAR</option><option value='704022'>ESTRUTURA BT CONVENCIONAL/ISOLADA - RETIRAR</option><option value='160'>ESTRUTURA IND 1 TRIF IND 2, 3, 4 - MODIFICAR - EST</option><option value='156'>ESTRUTURA INDICE 1 - INSTALAR - EST</option><option value='157'>ESTRUTURA INDICE 1 - REBAIXAR/ALCAR - EST</option><option value='159'>ESTRUTURA INDICE 1 OU 2 - RETIRAR - EST</option><option value='161'>ESTRUTURA INDICE 2 - INSTALAR - EST</option><option value='162'>ESTRUTURA INDICE 2, 3 OU 4 - REBAIXAR-ALCAR - EST</option><option value='163'>ESTRUTURA INDICE 3 OU 4 - INSTALAR - EST</option><option value='164'>ESTRUTURA INDICE 3 OU 4 - RETIRAR - EST</option><option value='165'>ESTRUTURA INDICE 4 RDP- CH FACA - SUBSTITUIR - EST</option><option value='704009'>ESTRUTURA MT INDICE 1 OU 2 MANUT - INSTALAR</option><option value='704010'>ESTRUTURA MT INDICE 1 OU 2 MANUT - RETIRAR</option><option value='704011'>ESTRUTURA MT INDICE 3 OU 4 MANUT - INSTALAR</option><option value='704012'>ESTRUTURA MT INDICE 3 OU 4 MANUT - RETIRAR</option><option value='704008'>ESTRUTURA MT REBAIXAR/ALCAR MANUT - REBAIXAR/ALCAR</option><option value='166'>ESTRUTURA RDP CE1 - MODIF CE2  - MODIFICAR - EST</option><option value='167'>ESTRUTURA RDP CE1 MODIF CE M4 - MODIFICAR - CJ</option><option value='168'>ESTRUTURA RDP CE2 - MODIF CEJ2 - MODIFICAR - EST</option><option value='704079'>HASTE ADICIONAL PARA ATERRAMENTO MANUT - INSTALAR</option><option value='324'>INSP AJUSTES TESTES OP RELI CH SEC RT -  EST</option><option value='704116'>INSP/AJUSTE/TESTE SUBIDA EQUIP MANUT - INSPECIONAR</option><option value='169'>INSPECAO BASICA RDR DIGIT PDA - INSPECIONAR - KM</option><option value='170'>INSPECAO BASICA RDU DIGIT PDA - INSPECIONAR - KM</option><option value='704117'>INSPECAO CADASTRO DE ARVORE MANUT - INSPECIONAR</option><option value='704109'>INSPECAO DETALHADA RDR COM DRONE MANUT - INSPECION</option><option value='704107'>INSPECAO DETALHADA RDR MANUT - INSPECIONAR</option><option value='704108'>INSPECAO DETALHADA RDU MANUT - INSPECIONAR</option><option value='325'>INSPECAO DRONE E TERMICA</option><option value='172'>INSPECAO FAIXA DIGIT PDA - INSPECIONAR - KM</option><option value='704111'>INSPECAO LEVANTAMENTO DE FAIXA MANUT - INSPECIONAR</option><option value='2200'>INSPECAO MAPEAMENTO DE ARVORE PELO APLICATIVO</option><option value='704110'>INSPECAO PARA PODA DE ARVORE MANUT - INSPECIONAR</option><option value='171'>INSPECAO PODA DIGIT PDA - INSPECIONAR - UN</option><option value='173'>INSPECAO RAPIDA RDR DIGIT PDA - INSPECIONAR - KM</option><option value='704112'>INSPECAO RAPIDA RDR MANUT - INSPECIONAR</option><option value='174'>INSPECAO RAPIDA RDU DIGIT PDA - INSPECIONAR - KM</option><option value='704113'>INSPECAO RAPIDA RDU MANUT - INSPECIONAR</option><option value='410'>INSPECAO RDR DRONE - ADITIVO - KM</option><option value='400'>INSPECAO RDR USANDO RPA DRONE - INSPECIONAR - KM</option><option value='175'>INSPECAO RECEP. FAIXA DIGIT PDA - INSPECIONAR - KM</option><option value='704114'>INSPECAO RECEPCAO DE FAIXA LIMPA MANUT - INSPECION</option><option value='297'>INSPECAO TERMOGRAFICA RDR DIG PDA - INSPECIONAR-KM</option><option value='176'>INSPECAO TERMOGRAFICA RDU DIG PDA - INSPECIONAR-KM</option><option value='704115'>INSPECAO TERMOGRAFICA RDU MANUT - INSPECIONAR</option><option value='328'>INSPECAO TESTE</option><option value='351'>INST DE ESPACADOR DE REDE - RDR - ATE 5 POR VAO</option><option value='350'>INST DE ESPACADOR DE REDE - RDU - ATE 5 POR VAO</option><option value='2292'>INSTALACAO DE ACCESS POINT AP-CP</option><option value='2290'>INSTALACAO DE CONCENTRADOR SECUNDARIO - CS</option><option value='2246'>INSTALAR RETIRAR SUBIST CAIXA COMANDO EQUIP</option><option value='704092'>INTERLIGACAO CIRCUITO BT MANUT - INSTALAR/RETIRAR</option><option value='704118'>ISOLADOR BASTAO EM ESTAI MANUT - INSTALAR/ SUBSTIT</option><option value='177'>ISOLADOR BASTAO POLIMERICO RDP - SUBSTITUIR - PC</option><option value='178'>ISOLADOR DE DISCO - SUBSTITUIR - PC</option><option value='180'>ISOLADOR DE PINO - INSTALAR - EST</option><option value='181'>ISOLADOR DE PINO - SUBSTITUIR - EST</option><option value='182'>ISOLADOR DE PINO POLIMERICO RDP - SUBSTITUIR - EST</option><option value='179'>ISOLADOR DISCO OU POLIM ESTAI - INSTALAR - PC</option><option value='704119'>ISOLADOR DISCO/BASTAO EM REDE MANUT - SUBSTITUIR</option><option value='704120'>ISOLADOR PINO REDE CONV OU RDP MANUT - SUBSTITUIR</option><option value='183'>ISOLADOR ROLDANA OU CASTANHA - SUBSTITUIR - EST</option><option value='184'>JAMPER - CIRCUITO DE MT MANOBRA - ABRIR - EST</option><option value='185'>JAMPER - CIRCUITO DE MT MANOBRA - FECHAR - EST</option><option value='323'>JAMPER CHAVE FUSIVEL - SUBSTITUIR - EST</option><option value='186'>JAMPER EQUIPAMENTO - SUBSTITUIR - PC</option><option value='188'>JAMPER ESTRUT RDP C DERIVACAO - FECHAR - EST</option><option value='187'>JAMPER ESTRUTURA C DOIS NIVEIS - SUBSTITUIR - EST</option><option value='189'>JAMPER FLAY-TAP BT - SUBSTITUIR - FSE</option><option value='190'>JAMPER FLAY-TAP MT - SUBSTITUIR - FSE</option><option value='191'>JAMPER PARA-RAIOS - SUBSTITUIR - EST</option><option value='192'>JAMPER TRANSFORMADOR - SUBSTITUIR - EST</option><option value='704122'>JUMPER MT CHAVE FUSIVEL MANUT - SUBSTITUIR</option><option value='704123'>JUMPER MT ESTRUTURA DOIS NIVEIS MANUT - SUBSTITUIR</option><option value='704126'>JUMPER MT RELIG/SECC/REGULADOR MANUT - SUBSTITUIR</option><option value='704127'>JUMPER MT TRANSFORMADOR MANUT - SUBSTITUIR</option><option value='704124'>JUMPER MT/BT FLY-TAP MANUT - SUBSTITUIR</option><option value='704125'>JUMPER MT/BT PARA-RAIOS MANUT - SUBSTITUIR</option><option value='135'>LAMINA BYPASS - SUBSTITUIR - EST</option><option value='704099'>LEITURA EM RELIGADOR MANUT - COLETAR</option><option value='703461'>LF ACEIRO DE 1 METRO QUADRADO</option><option value='2222'>LF ACEIRO DE 1 POSTE COM RAIO DE 3M - 28 M2</option><option value='2235'>LF ACEIRO HT 2 POSTES COM RAIO DE 3 M - 42 M2</option><option value='2236'>LF ACEIRO HTE 3 POSTES COM RAIO DE 3M - 56 M2</option><option value='2229'>LF CORTE DE CIPOS E TREPADEIRAS POR ESTRUTURA</option><option value='2220'>LF LIMPEZA DE FAIXA - 100 M2</option><option value='2221'>LF LIMPEZA DE FAIXA - 1000 - MIL M2</option><option value='2230'>LF LIMPEZA GERAL LOTES TERRENOS AREAS URB POR M2</option><option value='2232'>LF PINTURA RESIST CHAMA NO PE DE POSTE ATE 3M SOLO</option><option value='702817'>LF PINTURA RESIST CHAMA O PE DE POSTE ATE 3M SOLO</option><option value='2224'>LF PODA DE CERCA VIVA VEGET SIMILAR POR M LINEAR</option><option value='2223'>LF PODA SUPRESSAO ARVORE FAIXA RDR LIMIT 05 VAO</option><option value='2242'>LF PODA SUPRESSAO ARVORE FAIXA RDR LIMIT 3 VAO</option><option value='2234'>LF REABERTURA FAIXA - 100 M2</option><option value='2231'>LF REABERTURA FAIXA - ABERTURA ACESSO - 1000 M2</option><option value='2243'>LF SUPRESS PODA ARVORE C HERBICIDA LIMIT 3 ARVORES</option><option value='2225'>LF SUPRESSAO ARVORE DAP MAIOR QUE 1 M RDR OU LD</option><option value='2227'>LF SUPRESSAO ARVORE FAIXA AREA SILVICULTUR COMERC</option><option value='2226'>LF SUPRESSAO ARVORE ISOLADA FAIXA LD LIMIT 20 VAO</option><option value='2228'>LF SUPRESSAO BAMBUZAL DENTRO OU FORA FAIXA POR M2</option><option value='193'>LIMPEZA DE FAIXA - EXECUTAR - 1000 M2</option><option value='194'>LIMPEZA DE FAIXA - VAO ATE 150M - VAO</option><option value='704106'>LIMPEZA DE FAIXA MANUT - LIMPAR</option><option value='314'>LIMPEZA FAIXA  - CIPO E TREPADEIRA POR ESTRUTURA</option><option value='315'>LIMPEZA FAIXA - ACEIRO - 2 M2 - UN</option><option value='299'>LIMPEZA FAIXA - ARVORE  ISOL MT - PODA MAX 3 - VAO</option><option value='316'>LIMPEZA FAIXA - ARVORE  ISOL SILVICULT - MAX 5 VAO</option><option value='318'>LIMPEZA FAIXA - BAMBUZAL ISOL - SUPRIMIR - M2</option><option value='319'>LIMPEZA FAIXA - CERCA VIVA OU SIMILAR - M2</option><option value='320'>LIMPEZA FAIXA - REABERTURA - 1000 M2</option><option value='317'>LIMPEZA FAIXA - SILVICULT - SUPRIMIR MAIS DE 5 VAO</option><option value='202'>LUMINARIA - LIMPAR - UN</option><option value='195'>LUMINARIA - PONTO DE IP CONV -  NORMALIZAR - EST</option><option value='196'>LUMINARIA - PONTO DE IP CONV - SUBSTITUIR - EST</option><option value='197'>LUMINARIA - PONTO DE IP N CONV - NORMALIZAR - EST</option><option value='201'>LUMINARIA - PONTO IP SEMI-CONV -  NORMALIZAR - EST</option><option value='198'>LUMINARIA IP N CONV. ATE 3 LUM - SUBSTITUIR - EST</option><option value='199'>LUMINARIA IP N SEMI-CONV 1 LUM - SUBSTITUIR - EST</option><option value='200'>LUMINARIA IP N SEMI-CONV 3 LUM - SUBSTITUIR - EST</option><option value='1003'>LV ALCAR  DESCER OU DESCONECTAR MUFLA S MUDA EST</option><option value='1001'>LV ALCAR  REBAIXAR POSTE</option><option value='700042'>LV ALCAR MUFLA COM MUDANCA DE ESTRUTURA</option><option value='1002'>LV ALCAR MUFLA COM MUDANCA DE ESTRUTURA.</option><option value='700043'>LV ALCAR MUFLA SEM MUDANCA DE ESTRUTURA</option><option value='700150'>LV APRUMAR POSTE</option><option value='1004'>LV APRUMAR POSTE.</option><option value='700044'>LV DESCER OU DESCONECTAR MUFLA S MUD DE ESTRUTURA</option><option value='1192'>LV ELEVAR  REBAIXAR MT PARA APOIO A EMPREITEIR</option><option value='700153'>LV ELEVAR - REBAIXAR MT - EST MONO TANGENTE</option><option value='700154'>LV ELEVAR - REBAIXAR MT - EST TRIF C ENCABECAMENTO</option><option value='700156'>LV ELEVAR - REBAIXAR MT - EST TRIF COM EQUIPAMENTO</option><option value='700155'>LV ELEVAR - REBAIXAR MT - EST TRIFCOM EQUIPAMENTO</option><option value='700157'>LV ELEVAR - REBAIXAR MT - ESTRUTURA TRIF TANGENTE</option><option value='700151'>LV ELEVAR - REBAIXAR MT EST MONO COM ENCABECAMENTO</option><option value='700152'>LV ELEVAR - REBAIXAR MT EST MONO COM EQUIPAMENTO</option><option value='1005'>LV ELIMINAR VESPEIRO</option><option value='700001'>LV EMEN CALIB RET EMENDA CABO CA 1 FASE POR VAO</option><option value='700002'>LV EMEN CALIB RET EMENDA CABO CA 2 FASES POR VAO</option><option value='700003'>LV EMEN CALIB RET EMENDA CABO CA 3 FASES POR VAO</option><option value='700004'>LV EMEN CALIB RET EMENDA CABO CAA 1 FASE POR VAO</option><option value='700005'>LV EMEN CALIB RET EMENDA CABO CAA 2 FASES POR VAO</option><option value='700006'>LV EMEN CALIB RET EMENDA CABO CAA 3 FASES POR VAO</option><option value='700007'>LV EMEN OU CALIB CABO PROTEG 1 FASE POR VAO</option><option value='700008'>LV EMEN OU CALIB CABO PROTEG 2 FASES POR VAO</option><option value='700009'>LV EMEN OU CALIB CABO PROTEG 3 FASES POR VAO</option><option value='1006'>LV EMEND CB OU RETIR EMENDA ACIMA 1-0 1 FS VAO</option><option value='1007'>LV EMEND CB OU RETIR EMENDA ACIMA 1-0 2 FS VAO</option><option value='1008'>LV EMEND CB OU RETIR EMENDA ACIMA 1-0 3 FS VAO</option><option value='1009'>LV EMEND CB OU RETIR EMENDA ATE 1-0 - 1 FS VAO</option><option value='1010'>LV EMEND CB OU RETIR EMENDA ATE 1-0 - 2 FS VAO</option><option value='1011'>LV EMEND CB OU RETIR EMENDA ATE 1-0 - 3 FS VAO</option><option value='700012'>LV ENCABECAR CIRC MT PROT OU ISOL MONO - ESTRUTURA</option><option value='700013'>LV ENCABECAR CIRC MT PROT OU ISOL TRIF - ESTRUTURA</option><option value='1014'>LV ENCABECAR CONECTAR CIRCUITO MT PROT ISOL MONO</option><option value='1015'>LV ENCABECAR CONECTAR CIRCUITO MT PROT ISOL TRIF</option><option value='700010'>LV ENCABECAR E CONEC CIRC MT CONV MONO - ESTRUTURA</option><option value='700011'>LV ENCABECAR E CONEC CIRC MT CONV TRIF - ESTRUTURA</option><option value='1012'>LV ENCABECAR E CONECTAR CIRCUITO MT CONVENC MONO</option><option value='1013'>LV ENCABECAR E CONECTAR CIRCUITO MT CONVENC TRIF</option><option value='700014'>LV FECHAR JUMPER - POR FASE</option><option value='1016'>LV FECHAR JUMPER POR FASE - INCLUI TODAS CONEXOE</option><option value='700135'>LV INSPECIONAR CIRCUITO MT - POR KM</option><option value='1017'>LV INSPECIONAR CIRCUITO MT POR KM</option><option value='700136'>LV INSPECIONAR ESTRUTURA</option><option value='1018'>LV INSPECIONAR ESTRUTURA.</option><option value='700070'>LV INST - RET CH FACA TEMPORARIA - POR PECA</option><option value='700071'>LV INST - RET CH FUS TEMP GERADOR/MEGA JUMPER - PC</option><option value='700016'>LV INST ALCA ESTRIBO ATER RD PROT MONO - ESTRUTURA</option><option value='700017'>LV INST ALCA ESTRIBO ATER RD PROT TRIF - ESTRUTURA</option><option value='1033'>LV INST BRAC J EOU SUBST ESTRUT 1 2 CE1 PCEJ1OU2</option><option value='1034'>LV INST BRAC J SUBST ESTRUT 1 2 CE1 PCEJ1OU2 CHA</option><option value='1036'>LV INST CALHA PROTETORA P CHAVE FACA EM BRACO J</option><option value='700064'>LV INST CH FACA - CH FUSIVEL POSTE DE SECAO - 1 CH</option><option value='700066'>LV INST CH FACA - CH FUSIVEL POSTE DE SECAO - 2 CH</option><option value='700068'>LV INST CH FACA - CH FUSIVEL POSTE DE SECAO - 3 CH</option><option value='700072'>LV INST CH REP, TRIPSAVER, CIRC MONO C MUD DE ESTR</option><option value='700074'>LV INST CH REP, TRIPSAVER, CIRC TRIF C MUD ESTR</option><option value='1038'>LV INST CHAVE SF6 E SIMILARES C MUDANCA D ESTRUT</option><option value='1050'>LV INST ESTRUTURA MT P RECEBER RR - QUALQUER IND</option><option value='1052'>LV INST PARA-RAIOS BT POR ESTRUT - INCLUI CONEXO</option><option value='1055'>LV INST PROTETOR DE BUCHA EM RELIGADOR SECC TRIF</option><option value='700079'>LV INST PROTETOR DE BUCHA EM TRANSFORMADOR </option><option value='700078'>LV INST PROTETOR DE BUCHA RELIGADOR/SECC TRIFASICO</option><option value='1059'>LV INST RELIGADOR OU SECCIONADOR TRIF C ESTRUTUR</option><option value='1060'>LV INST RELIGADOR OU SECCIONADOR TRIF S ESTRUTUR</option><option value='700082'>LV INST RELIGADOR SEC OU CJ MEDICAO TRIF C MUD EST</option><option value='700083'>LV INST RELIGADOR SEC OU CJ MEDICAO TRIF S MUD EST</option><option value='700015'>LV INST RET COBERTURA ISOLANTE OU TEMPORARIA - VAO</option><option value='700102'>LV INST RET ESTRUTURA INDICE 1.3 C CH PROV RD CONV</option><option value='1037'>LV INST RETIR OU SUBSTIT CAIXA COMANDO EQUIPAMEN</option><option value='700080'>LV INST RT OU POSTO DE TRANSFORMACAO - POR UNIDADE</option><option value='700085'>LV INST SEC, RELIGADOR OU TRANSF MONO C MUD EST</option><option value='700086'>LV INST SEC, RELIGADOR OU TRANSF MONO S MUD EST</option><option value='1061'>LV INST SECCIONADOR RELIGADOR TRAFO MONO C ESTRU</option><option value='1062'>LV INST SECCIONADOR RELIGADOR TRAFO MONO S ESTRU</option><option value='1020'>LV INSTAL RETIR COBERT ISOL OU TEMPOR POR VAO FS</option><option value='1023'>LV INSTALAR 01 CHAVE FACA OU FUSIVEL C MUD ESTRU</option><option value='1021'>LV INSTALAR 01 CHAVE FACA OU FUSIVEL S MUD ESTRU</option><option value='1024'>LV INSTALAR 03 CHAVES FACA OU FUSIV C MUD ESTRUT</option><option value='1022'>LV INSTALAR 03 CHAVES FACA OU FUSIV S MUD ESTRUT</option><option value='700058'>LV INSTALAR 1 CH FACA OU FUSIVEL, C MUD ESTRUTURA</option><option value='700059'>LV INSTALAR 1 CH FACA OU FUSIVEL, S MUD ESTRUTURA</option><option value='700060'>LV INSTALAR 3 CH FACA OU FUSIVEL, C MUD ESTRUTURA</option><option value='700061'>LV INSTALAR 3 CH FACA OU FUSIVEL, S MUD ESTRUTURA</option><option value='700097'>LV INSTALAR AGARRA PAPAGAIOS - POR ESTRUTURA</option><option value='1027'>LV INSTALAR AGARRA PAPAGAIOS ESTRUTURA MONOFASIC</option><option value='1028'>LV INSTALAR AGARRA PAPAGAIOS ESTRUTURA TRIFASICA</option><option value='1029'>LV INSTALAR ALCA ESTRIBO P ATERRAM RDP MONO ESTR</option><option value='1030'>LV INSTALAR ALCA ESTRIBO P ATERRAM RDP TRIF ESTR</option><option value='1019'>LV INSTALAR ALCA ESTRIBO P ATERRAM TEMPORIO PECA</option><option value='700062'>LV INSTALAR CAIXA DE COMANDO DE EQUIPAMENTOS</option><option value='700099'>LV INSTALAR CALHA PROT ISOL DE PINO - ESTRUTURA</option><option value='700098'>LV INSTALAR CALHA PROTETORA CH FACA - ESTRUTURA</option><option value='1035'>LV INSTALAR CALHA PROTETORA PARA ISOLADOR DE PIN</option><option value='700143'>LV INSTALAR CH FACA XFX, HX E JX (PORTICO SE)</option><option value='1025'>LV INSTALAR CHAVE FACA TEMPORARIA POR PECA</option><option value='1026'>LV INSTALAR CHAVE FUSIVEL TEMPORARIA POR PECA</option><option value='1040'>LV INSTALAR CHAVE REPET CIRCUITO MONO C ESTRUTUR</option><option value='1041'>LV INSTALAR CHAVE REPET CIRCUITO TRIF C ESTRUTUR</option><option value='1039'>LV INSTALAR CHAVE SF6 E SIMILARES</option><option value='1044'>LV INSTALAR CONJUNTO DE MEDICAO</option><option value='1045'>LV INSTALAR CONJUNTO DE MEDICAO.</option><option value='1054'>LV INSTALAR CONJUNTO DE PARA-RAIOS MT TRIFASICO</option><option value='1042'>LV INSTALAR CONTRA POSTE E ESTAI INCLUI CONEXOES</option><option value='700018'>LV INSTALAR ESPACADOR DE MT EM RDA CONV - POR VAO</option><option value='1046'>LV INSTALAR ESPACADOR DE MT EM RDA CONV POR VAO</option><option value='1047'>LV INSTALAR ESTAI CRUZETA POSTE OU CZ A CZ</option><option value='700100'>LV INSTALAR ESTAI CZ PT OU CZ A CZ (INC CONEXOES)</option><option value='700103'>LV INSTALAR ESTRUTURA DE MT PARA RECEBER REDE</option><option value='1049'>LV INSTALAR ESTRUTURA INDICE 13  COM CH FUSI PRO</option><option value='1048'>LV INSTALAR ESTRUTURA INDICE 13  COM CH FUSIVEL</option><option value='1051'>LV INSTALAR ISOLADOR EM ESTAI</option><option value='700104'>LV INSTALAR ISOLADORES EM ESTAI - POR ESTAI</option><option value='1032'>LV INSTALAR MALHA DE ATERRAMENTO ATE 3 HASTES</option><option value='1031'>LV INSTALAR MALHA DE ATERRAMENTO HASTE ADICIONAL</option><option value='2237'>LV INSTALAR MANTA RDP POR PONTO</option><option value='700076'>LV INSTALAR PARA-RAIOS MT - POR PECA</option><option value='1053'>LV INSTALAR PARA-RAIOS MT MONO</option><option value='700148'>LV INSTALAR PARA-RAIOS SAIDA DA LD (PORTICO SE)</option><option value='700158'>LV INSTALAR POSTE C ESTRUTURA MT DE ENCABECAMENTO</option><option value='1043'>LV INSTALAR POSTE COM ESTRUTURA</option><option value='700160'>LV INSTALAR POSTE COM ESTRUTURA DE MT TANGENTE</option><option value='1056'>LV INSTALAR PROTETOR DE BUCHA EM TRANSFORMADOR</option><option value='1058'>LV INSTALAR REGULADOR DE TENSAO 3 UNID EM BANCAD</option><option value='1057'>LV INSTALAR REGULADOR DE TENSAO EM POSTE UNIDA</option><option value='700019'>LV INSTALAR VAO DE MT CABO ACIMA DE 1/0 - 1 FASE</option><option value='700021'>LV INSTALAR VAO DE MT CABO ACIMA DE 1/0 - 2 FASES</option><option value='700023'>LV INSTALAR VAO DE MT CABO ACIMA DE 1/0 - 3 FASES</option><option value='700025'>LV INSTALAR VAO DE MT CABO ATE 1/0 - 1 FASE</option><option value='700027'>LV INSTALAR VAO DE MT CABO ATE 1/0 - 2 FASES</option><option value='700029'>LV INSTALAR VAO DE MT CABO ATE 1/0 - 3 FASES</option><option value='700162'>LV INSTALAR/INTERCALAR POSTE C EST ENCABECAMENTO</option><option value='700163'>LV INSTALAR/INTERCALAR POSTE C ESTRUTURA TANGENTE</option><option value='700096'>LV INTERVIR EM ESTRUTURAS MT COM DOIS OU + NIVEIS</option><option value='700045'>LV MANUT CH FACA - CH FUSIVEL DE DERIVACAO 1 FASE</option><option value='700046'>LV MANUT CH FACA - CH FUSIVEL DE DERIVACAO 3 FASES</option><option value='700047'>LV MANUT CH FUSIVEL DE TRANSFORMADOR 1 CHAVE</option><option value='700048'>LV MANUT CH FUSIVEL DE TRANSFORMADOR 3 CHAVES </option><option value='1207'>LV MANUT SUBSTI CHAVES FACA XFX HX JX - PORTICO SE</option><option value='1211'>LV MANUT SUBSTIT CONEX BARRAS PRINC - PORTICO SE</option><option value='700145'>LV MANUT/SUBST CONEXOES BARRAS DE TRANSF, TUBOS</option><option value='1066'>LV MANUTENC CHAVE FUSIVEL DE TRANSFO 1 CHAVE</option><option value='1067'>LV MANUTENC CHAVE FUSIVEL DE TRANSFO 2 CHAVE</option><option value='1068'>LV MANUTENC CHAVE FUSIVEL DE TRANSFO 3 CHAVE</option><option value='700142'>LV MANUTENCAO DE CH FACA XFX, HX E JX (PORTICO SE)</option><option value='1063'>LV MANUTENCIONAR CHAVE FACA NF</option><option value='1064'>LV MANUTENCIONAR CHAVE FACA NF 02 CHAVE</option><option value='1065'>LV MANUTENCIONAR CHAVE FACA NF 03 CHAVE</option><option value='1069'>LV MANUTENCIONAR CHAVE FUSIVEL 1 CH</option><option value='1070'>LV MANUTENCIONAR CHAVE FUSIVEL 2 CH</option><option value='1071'>LV MANUTENCIONAR CHAVE FUSIVEL 3 CH</option><option value='1072'>LV MANUTENCIONAR CONEXOES EM CHAVE FACA 01 CH</option><option value='1073'>LV MANUTENCIONAR CONEXOES EM CHAVE FACA 02 CH</option><option value='1074'>LV MANUTENCIONAR CONEXOES EM CHAVE FACA 03 CH</option><option value='700106'>LV MOD EST CE3- CE3-J E CE4-J PARA CEM4</option><option value='700107'>LV MOD ESTRUTURA INDICE TANGENTE P ENCABECAMENTO</option><option value='1075'>LV MODIF SUBS ESTRUTURA INDICE 1 OU 2  3-4 2-3</option><option value='700105'>LV MODIFICAR ESTRUTURA CE3- CE3-J E CE4-J P CEM4</option><option value='1076'>LV NUMERAR  RENUMERAR EQUIPAMENTO</option><option value='1077'>LV OPERAR DISPOSITIVO DE MANOBRA</option><option value='700137'>LV OPERAR DISPOSITIVOS DE MANOBRA</option><option value='700139'>LV PODA EM CERCAS VIVAS - BAMBUZAIS - POR VAO</option><option value='700140'>LV PODAR ARVORE</option><option value='1078'>LV PODAR ARVORE.</option><option value='1079'>LV REBAIXAR COPA DE ARVORE</option><option value='700141'>LV REBAIXAR COPA DE ARVORE PARA PERMITIR SUPRESSAO</option><option value='1080'>LV REMOVER POSTE ATE 1 METRO INCLUI A SOLTURA E</option><option value='700065'>LV RET CH FACA - CH FUSIVEL POSTE DE SECAO - 1 CH</option><option value='700067'>LV RET CH FACA - CH FUSIVEL POSTE DE SECAO - 2 CH</option><option value='700069'>LV RET CH FACA - CH FUSIVEL POSTE DE SECAO - 3 CH</option><option value='700109'>LV RET CH FUSIVEL TEMP PARA GERADOR - MEGA JUMPER</option><option value='700073'>LV RET CH REP, TRIPSAVER, CIRC MONO S MUD ESTR</option><option value='700075'>LV RET CH REP, TRIPSAVER, CIRC TRIF S MUD ESTR</option><option value='700101'>LV RET ESTAI CZ PT OU CZ A CZ (INCLUI CONEXOES)</option><option value='1088'>LV RET ESTRUT INDICE 1-3 C CH FUSIV RD CONVENCIO</option><option value='1089'>LV RET ESTRUT INDICE 1-3 C CH FUSIV RD PROTEGIDA</option><option value='700110'>LV RET ESTRUTURA MT COM OU SEM EQUIP E VAOS ADJACE</option><option value='700089'>LV RET RELIGADOR - SEC -SF6 TRIF (PARA MANUTENCAO)</option><option value='700084'>LV RET RELIGADOR SEC OU CJ MEDICAO TRIF S MUD EST</option><option value='700081'>LV RET RT OU POSTO DE TRANSFORMACAO - POR UNIDADE</option><option value='700090'>LV RET SEC, RELIGADOR OU TRANSF MONO (MANUTENCAO)</option><option value='700087'>LV RET SEC, RELIGADOR OU TRANSF MONO S MUD EST</option><option value='1090'>LV RETIR ESTRUTURA MT C OU S EQUIP E VAOS ADJACE</option><option value='1085'>LV RETIRAR  CHAVE FACA TEMPORARIA POR PECA</option><option value='1081'>LV RETIRAR 1 CHAVE FACA  FUSIVEL</option><option value='1082'>LV RETIRAR 3 CHAVES FACAS FUSIVEIS</option><option value='700063'>LV RETIRAR CAIXA DE COMANDO DE EQUIPAMENTOS</option><option value='700108'>LV RETIRAR CHAVE FACA TEMPORARIA - POR PECA</option><option value='1084'>LV RETIRAR CHAVE FUSIVEL TEMPORARIA POR PECA</option><option value='1083'>LV RETIRAR CHAVE SF6 E SIMILARES</option><option value='1086'>LV RETIRAR CHAVE TRIPOLAR</option><option value='700088'>LV RETIRAR CHAVE TRIPOLAR.</option><option value='700144'>LV RETIRAR DE CH FACA XFX, HX E JX (PORTICO SE)</option><option value='1087'>LV RETIRAR ESTAI</option><option value='1091'>LV RETIRAR PARA RAIOS DE MT MONOFASICO POR ESTRU</option><option value='1092'>LV RETIRAR PARA RAIOS DE MT TRIFASICO POR ESTRUT</option><option value='700077'>LV RETIRAR PARA-RAIOS MT - POR PECA</option><option value='700149'>LV RETIRAR PARA-RAIOS SAIDA DA LD (PORTICO SE)</option><option value='1093'>LV RETIRAR PIPA  LIMPEZA DE ESTRUTURA</option><option value='700111'>LV RETIRAR PIPA - LIMPEZA POR ESTRUTURA</option><option value='700159'>LV RETIRAR POSTE C ESTRUTURA DE MT ENCABECAMENTO</option><option value='700161'>LV RETIRAR POSTE COM ESTRUTURA MT TANGENTE</option><option value='1094'>LV RETIRAR POSTE SEM ESTRUTURAS DE MT BT</option><option value='700164'>LV RETIRAR POSTE SEM ESTRUTURAS DE MT E BT</option><option value='1096'>LV RETIRAR REGULADOR DE TENSAO 3 UNIDADES EM BAN</option><option value='1095'>LV RETIRAR REGULADOR DE TENSAO EM POSTE</option><option value='1097'>LV RETIRAR RELIGADOR  SECCIONALIZADOR TRIFASICO</option><option value='1098'>LV RETIRAR SECCIONADOR OU RELIGADOR  TRAFO MONO</option><option value='700020'>LV RETIRAR VAO DE MT CABO ACIMA DE 1/0 - 1 FASE</option><option value='700022'>LV RETIRAR VAO DE MT CABO ACIMA DE 1/0 - 2 FASES</option><option value='700024'>LV RETIRAR VAO DE MT CABO ACIMA DE 1/0 - 3 FASES</option><option value='700026'>LV RETIRAR VAO DE MT CABO ATE 1/0 - 1 FASE</option><option value='700028'>LV RETIRAR VAO DE MT CABO ATE 1/0 - 2 FASES</option><option value='700030'>LV RETIRAR VAO DE MT CABO ATE 1/0 - 3 FASES</option><option value='1101'>LV SECCIONAR CONDUTOR ACIMA DE 1-0 - 01 FASE</option><option value='1102'>LV SECCIONAR CONDUTOR ACIMA DE 1-0 - 02 FASES</option><option value='1103'>LV SECCIONAR CONDUTOR ACIMA DE 1-0 - 03 FASES</option><option value='700031'>LV SECCIONAR CONDUTOR ACIMA DE 1/0 - 1 FASE</option><option value='700032'>LV SECCIONAR CONDUTOR ACIMA DE 1/0 - 2 FASES</option><option value='700033'>LV SECCIONAR CONDUTOR ACIMA DE 1/0 - 3 FASES</option><option value='1104'>LV SECCIONAR CONDUTOR ATE CABO 1-0 - 01 FASE</option><option value='1105'>LV SECCIONAR CONDUTOR ATE CABO 1-0 - 02 FASES</option><option value='1106'>LV SECCIONAR CONDUTOR ATE CABO 1-0 - 03 FASES</option><option value='700034'>LV SECCIONAR CONDUTOR ATE CABO 1/0 - 1 FASE</option><option value='700035'>LV SECCIONAR CONDUTOR ATE CABO 1/0 - 2 FASES</option><option value='700036'>LV SECCIONAR CONDUTOR ATE CABO 1/0 - 3 FASES</option><option value='700037'>LV SECCIONAR JUMPER OU FLY- TAP EM ESTRUTURA MONO</option><option value='700038'>LV SECCIONAR JUMPER OU FLY- TAP EM ESTRUTURA TRIF</option><option value='1099'>LV SECCIONAR JUMPER OU FLY-TAP EM ESTRUTURA MONO</option><option value='1100'>LV SECCIONAR JUMPER OU FLY-TAP EM ESTRUTURA TRIF</option><option value='1206'>LV SERV C BASTAO PLATAFORMA ACRESCEN SERV EXECUT</option><option value='700138'>LV SERVICO BASTAO E PLATAFORMA ACRESC TAREFA EXEC</option><option value='1109'>LV SOLTAR AO SOLO MT REDE MONO CONV PROT ISOLADA</option><option value='1107'>LV SOLTAR AO SOLO MT REDE TRIFASICA CONVENCIONAL</option><option value='1108'>LV SOLTAR AO SOLO MT REDE TRIFASICA ISOLADA</option><option value='700039'>LV SOLTAR MT AO SOLO RD MONO CONV - PROT - ISOL</option><option value='700040'>LV SOLTAR MT AO SOLO RD TRIF CONV </option><option value='700041'>LV SOLTAR MT AO SOLO RD TRIF PROTEGIDA - ISOLADA</option><option value='700091'>LV SUBST 1 CH FUSIVEL EM POSTE DE TRANSFORMADOR</option><option value='700049'>LV SUBST 1 FLY-TAP E CONEXOES NECESSARIAS - JUMPER</option><option value='1115'>LV SUBST 1 JUMPER COM CONEXOES ESTRUTURA SEM EQU</option><option value='700092'>LV SUBST 2 CH FUSIVEIS EM POSTE DE TRANSFORMADOR</option><option value='1135'>LV SUBST 2 CHAVES FUSIVEIS EM POSTE DE TRAFO</option><option value='700050'>LV SUBST 2 FLY-TAP E CONEXOES NECESSARIAS - JUMPER</option><option value='1116'>LV SUBST 2 JUMPER COM CONEXOES ESTRUTURA SEM EQU</option><option value='700093'>LV SUBST 3 CH FUSIVEIS EM POSTE DE TRANSFORMADOR</option><option value='1136'>LV SUBST 3 CHAVES FUSIVEIS EM POSTE DE TRAFO</option><option value='700051'>LV SUBST 3 FLY-TAP E CONEXOES NECESSARIAS - JUMPER</option><option value='1117'>LV SUBST 3 JUMPER COM CONEXOES ESTRUTURA SEM EQU</option><option value='1120'>LV SUBST AMARRACOES ESPACADOR OU ANTI BRACO</option><option value='700094'>LV SUBST CARTUCHO -ELO FUS 1 CH FUS S DESLIGAMENTO</option><option value='700095'>LV SUBST CARTUCHO -ELO FUS 3 CH FUS S DESLIGAMENTO</option><option value='1121'>LV SUBST CARTUCHO OU ELO FUSIVEL DE 1 CH SEM DES</option><option value='1122'>LV SUBST CARTUCHO OU ELO FUSIVEL DE 2 CH SEM DES</option><option value='1123'>LV SUBST CARTUCHO OU ELO FUSIVEL DE 3 CH SEM DES</option><option value='1131'>LV SUBST CHAVE FUSIVEL EM POSTE DE SECAO 1 CH</option><option value='1132'>LV SUBST CHAVE FUSIVEL EM POSTE DE SECAO 2 CH</option><option value='1133'>LV SUBST CHAVE FUSIVEL EM POSTE DE SECAO 3 CH</option><option value='700146'>LV SUBST CONEXOES - JUMPERS DO NEUTRO E RELIGADOR</option><option value='700120'>LV SUBST CRUZETA IND 2 C ENCA OU IND 3 PT C TRANSF</option><option value='700122'>LV SUBST CRUZETA IND 2 TANG C CH FUS DERI OU FACA</option><option value='700113'>LV SUBST CRUZETA INDICE 1 C CH FUSIVEL DERIVACAO</option><option value='700114'>LV SUBST CRUZETA INDICE 1 EM POSTE DE COM TRANSF</option><option value='700119'>LV SUBST CRUZETA INDICE 2 C ENCABECAMENTO OU IND 3</option><option value='700115'>LV SUBST CRUZETA INDICE 2, TANGENTE POSTE C TRANSF</option><option value='1153'>LV SUBST CRUZETA INDICE 2-3 1 OU 2 PECAS C CHAVE</option><option value='1157'>LV SUBST CRUZETA INDICE 2-3 3-4 1OU2 PECAS C CH</option><option value='700123'>LV SUBST CRUZETA INDICE 2-3 OU 4 C CH FACA OU FUS</option><option value='700116'>LV SUBST CRUZETA INDICE 2.3 OU 4 C CH FACA OU FUS</option><option value='700124'>LV SUBST CRUZETA INDICE 2.3 OU 4 EM POSTE C TRANSF</option><option value='700125'>LV SUBST ESPACADOR LOSANGULAR OU BRACO ANTIBALANCO</option><option value='700126'>LV SUBST EST CE1 OU CE2 P CEJ2 C INST CHFUS TR DER</option><option value='700127'>LV SUBST ESTRUTURA IND CE1 OU CE2 P CEJ1 OU CEJ2</option><option value='700128'>LV SUBST FERRAGENS DANIFICADAS  </option><option value='700129'>LV SUBST ISOL DE ANCORAGEM GRAMPO PINO PILAR 1 PC</option><option value='700130'>LV SUBST ISOL DE ANCORAGEM GRAMPO PINO PILAR 2 PC</option><option value='700131'>LV SUBST ISOL DE ANCORAGEM GRAMPO PINO PILAR 3 PC</option><option value='700132'>LV SUBST ISOL DE ANCORAGEM GRAMPO PINO PILAR 4 PC</option><option value='700133'>LV SUBST ISOL DE ANCORAGEM GRAMPO PINO PILAR 5 PC</option><option value='700134'>LV SUBST ISOL DE ANCORAGEM GRAMPO PINO PILAR 6 PC</option><option value='1165'>LV SUBST ISOLADOR DE ANCORAGEM GRAMPO 06 CADE</option><option value='1160'>LV SUBST ISOLADOR DE ANCORAGEM OU GRAMPO 01 CADE</option><option value='1161'>LV SUBST ISOLADOR DE ANCORAGEM OU GRAMPO 02 CADE</option><option value='1162'>LV SUBST ISOLADOR DE ANCORAGEM OU GRAMPO 03 CADE</option><option value='1163'>LV SUBST ISOLADOR DE ANCORAGEM OU GRAMPO 04 CADE</option><option value='1164'>LV SUBST ISOLADOR DE ANCORAGEM OU GRAMPO 05 CADE</option><option value='1168'>LV SUBST ISOLADOR DE PINO 01 PECA</option><option value='1167'>LV SUBST ISOLADOR DE PINO 02 PECAS</option><option value='1166'>LV SUBST ISOLADOR DE PINO 03 PECAS</option><option value='1172'>LV SUBST ISOLADOR PINO EOU PINO ENCABECAM 1 PECA</option><option value='1173'>LV SUBST ISOLADOR PINO EOU PINO ENCABECAM 2 PECA</option><option value='1174'>LV SUBST ISOLADOR PINO EOU PINO ENCABECAM 3 PECA</option><option value='1175'>LV SUBST ISOLADOR PINO EOU PINO ENCABECAM 4 PECA</option><option value='1176'>LV SUBST ISOLADOR PINO EOU PINO ENCABECAM 5 PECA</option><option value='1177'>LV SUBST ISOLADOR PINO EOU PINO ENCABECAM 6 PECA</option><option value='1184'>LV SUBST JUMPER SUP OU INF DA CHAVE DO TR F</option><option value='1185'>LV SUBST JUMPER SUP OU INF DA CHAVE DO TR O</option><option value='1182'>LV SUBST JUMPERS  DE REGULADOR DE TENSAO</option><option value='1187'>LV SUBST JUMPERS INFER DAS CHAVES DO TR TRIFA O</option><option value='1188'>LV SUBST JUMPERS INFER E SUPER DAS CHAVES DO TR</option><option value='1186'>LV SUBST JUMPERS SUPER DAS CHAVES FUSIVEL DO TR O</option><option value='1119'>LV SUBST PARA-RAIO MT C INST TANQUE DO TR</option><option value='1193'>LV SUBST RELIGADOR E SECCIONALIZADOR TRIFASICO</option><option value='1191'>LV SUBST RELIGADOR SECCIONALIZADOR OU TR MONO</option><option value='1209'>LV SUBSTIT CONEX JUMPERS NEUTRO RELIG - PORTI SE</option><option value='1208'>LV SUBSTIT PARA-RAIOS SAIDA DA LD - PORTICO SE</option><option value='1148'>LV SUBSTITUI CRUZETA INDICE 4 EM POSTE DE TRAFO</option><option value='1210'>LV SUBSTITUICAO DE ISOLADOR PEDESTAL - PORTIC SE</option><option value='1134'>LV SUBSTITUIR 1 CHAVE FUSIVEL EM POSTE DE TRAFO</option><option value='1111'>LV SUBSTITUIR 1 FLY-TAP E CONEXOES NECESSARIAS</option><option value='1112'>LV SUBSTITUIR 2 FLY-TAP E CONEXOES NECESSARIAS</option><option value='1113'>LV SUBSTITUIR 3 FLY-TAP E CONEXOES NECESSARIAS</option><option value='1125'>LV SUBSTITUIR CHAVE FACA 01 FASE</option><option value='1126'>LV SUBSTITUIR CHAVE FACA 02 FASES</option><option value='1127'>LV SUBSTITUIR CHAVE FACA 03 FASES</option><option value='1128'>LV SUBSTITUIR CHAVE FACA NF 01 FASE</option><option value='1129'>LV SUBSTITUIR CHAVE FACA NF 02 FASES</option><option value='1130'>LV SUBSTITUIR CHAVE FACA NF 03 FASES</option><option value='1124'>LV SUBSTITUIR CHAVE SF6 E SIMILARES</option><option value='700052'>LV SUBSTITUIR CONEXAO - 1 PECA</option><option value='1137'>LV SUBSTITUIR CONEXAO 01 PECA</option><option value='700053'>LV SUBSTITUIR CONEXOES - 2 PECAS</option><option value='700054'>LV SUBSTITUIR CONEXOES - 3 PECAS</option><option value='700055'>LV SUBSTITUIR CONEXOES - 4 PECAS</option><option value='700056'>LV SUBSTITUIR CONEXOES - 5 PECAS</option><option value='700057'>LV SUBSTITUIR CONEXOES - 6 PECAS</option><option value='1138'>LV SUBSTITUIR CONEXOES 02 PECAS</option><option value='1139'>LV SUBSTITUIR CONEXOES 03 PECAS</option><option value='1140'>LV SUBSTITUIR CONEXOES 04 PECAS</option><option value='1141'>LV SUBSTITUIR CONEXOES 05 PECAS</option><option value='1142'>LV SUBSTITUIR CONEXOES 06 PECAS</option><option value='1149'>LV SUBSTITUIR CRUZETA INDICE 1</option><option value='1143'>LV SUBSTITUIR CRUZETA INDICE 1 EM POSTE C TRAFO</option><option value='700112'>LV SUBSTITUIR CRUZETA INDICE 1.</option><option value='1150'>LV SUBSTITUIR CRUZETA INDICE 2  1 OU 2 PECAS TAN</option><option value='1145'>LV SUBSTITUIR CRUZETA INDICE 2 ENCABECAMENTO</option><option value='700121'>LV SUBSTITUIR CRUZETA INDICE 2 TANGENTES</option><option value='1144'>LV SUBSTITUIR CRUZETA INDICE 2 UMA OU DUAS PECAS</option><option value='1152'>LV SUBSTITUIR CRUZETA INDICE 2-3 1 OU 2 PECAS</option><option value='1146'>LV SUBSTITUIR CRUZETA INDICE 2-3 3 E 4 EM POSTE TR</option><option value='1154'>LV SUBSTITUIR CRUZETA INDICE 3 1 OU 2 PECAS</option><option value='1147'>LV SUBSTITUIR CRUZETA INDICE 3 EM POSTE DE TRAFO</option><option value='1156'>LV SUBSTITUIR CRUZETA INDICE 3 OU 4 COM CH FACA</option><option value='1155'>LV SUBSTITUIR CRUZETA INDICE 4 1 OU 2 PECAS</option><option value='700117'>LV SUBSTITUIR CRUZETA INDICE HT (1 OU 2 PECAS)</option><option value='1159'>LV SUBSTITUIR CRUZETA INDICE HT 1 OU 2 PECAS</option><option value='700118'>LV SUBSTITUIR CRUZETA INDICE TE (1 OU 2 PECAS)</option><option value='1158'>LV SUBSTITUIR CRUZETA INDICE TE 1 OU 2 PECAS</option><option value='1110'>LV SUBSTITUIR FERRAGENS DANIFICADAS</option><option value='1114'>LV SUBSTITUIR GRAMPO DE ANCORAGEM POR PECA</option><option value='1169'>LV SUBSTITUIR ISOLADOR DE PINO 04 PECAS</option><option value='1170'>LV SUBSTITUIR ISOLADOR DE PINO 05 PECAS</option><option value='1171'>LV SUBSTITUIR ISOLADOR DE PINO 06 PECAS</option><option value='700147'>LV SUBSTITUIR ISOLADOR PEDESTAL (PORTICO SE)</option><option value='1183'>LV SUBSTITUIR JUMPERS  DE RELIGADOR</option><option value='1178'>LV SUBSTITUIR JUMPERS DE 1 CHAVE-FACA OU FUSIVEL</option><option value='1179'>LV SUBSTITUIR JUMPERS DE 2 CHAVES-FACA OU FUSIVEIS</option><option value='1180'>LV SUBSTITUIR JUMPERS DE 3 CHAVES-FACA OU FUSIVEL</option><option value='1181'>LV SUBSTITUIR JUMPERS DE CHAVE SF6</option><option value='1151'>LV SUBSTITUIR MODIFICAR CRUZETA INDICE 2</option><option value='1118'>LV SUBSTITUIR PARA RAIO MT</option><option value='1189'>LV SUBSTITUIR POSTE COM ESTRUTURA MT</option><option value='1190'>LV SUBSTITUIR REGULADOR DE TENSAO</option><option value='1194'>LV SUBSTITUIR VAO MT CABO ACIMA DE 1-0 1 FASE</option><option value='1195'>LV SUBSTITUIR VAO MT CABO ACIMA DE 1-0 2 FASES</option><option value='1196'>LV SUBSTITUIR VAO MT CABO ACIMA DE 1-0 3 FASES</option><option value='1197'>LV SUBSTITUIR VAO MT CABO ATE 1-0 1 FASE</option><option value='1198'>LV SUBSTITUIR VAO MT CABO ATE 1-0 2 FASES</option><option value='1199'>LV SUBSTITUIR VAO MT CABO ATE 1-0 3 FASES</option><option value='1200'>LV TENSIONAR VAO MT CABO ACIMA 1-0 - 1 FASE VAO</option><option value='1201'>LV TENSIONAR VAO MT CABO ACIMA 1-0 - 2 FASE VAO</option><option value='1202'>LV TENSIONAR VAO MT CABO ACIMA 1-0 - 3 FASE VAO</option><option value='1203'>LV TENSIONAR VAO MT CABO ATE 1-0 - 1 FASE POR VAO</option><option value='1204'>LV TENSIONAR VAO MT CABO ATE 1-0 - 2 FASES POR VAO</option><option value='1205'>LV TENSIONAR VAO MT CABO ATE 1-0 - 3 FASES POR VAO</option><option value='704131'>MANEJAR VESPEIRO MANUT - MANEJAR</option><option value='2241'>MANUT OPERAD GERADOR 500KVA EQUIPE MULTI COMPLETA</option><option value='704016'>MAO FRANCESA/CINTA MANUT - SUBSTITUIR/VIRAR</option><option value='203'>MAO-FRANCESA - SUBSTITUIR/VIRAR - EST</option><option value='704007'>MATERIAL CONC BASE POSTE 1000DAN MANUT - INSTALAR</option><option value='704005'>MATERIAL CONC BASE POSTE 300DAN MANUT - INSTALAR</option><option value='704006'>MATERIAL CONC BASE POSTE 600DAN MANUT - INSTALAR</option><option value='2211'>MIV FAIXA DENSID ALTA VEGET - D1 - HA - 10000M2</option><option value='2213'>MIV FAIXA DENSID BAIXA VEGET - D3 - HA - 10000 M2</option><option value='2212'>MIV FAIXA DENSID MEDIA VEGET - D2 - HA - 10000 M2</option><option value='2214'>MIV FAIXA DENSID ULTRA BAIXA VEGET - D4-HA-10000M2</option><option value='2219'>MIV SUPRES-PODA ARV ISOL - HERB TOCO - ATE 3 VAO</option><option value='2215'>MIV SUPRES-PODA ARV ISOL - HERB TOCO - ATE 5 VAO</option><option value='704100'>NUMERACAO DE EQUIPAMENTO MANUT - INSTALAR</option><option value='204'>OBJETO ESTRANHO DA REDE - RETIRAR</option><option value='704105'>OBJETO ESTRANHO NA REDE MANUT - RETIRAR</option><option value='704128'>OPERAR DISPOSITIVO P/ TRANSF CARGA MAN - ABRIR/FEC</option><option value='9'>PA - RDU PODA BAMBU POR METRO LINEAR - ARVORE</option><option value='2204'>PA CORTE DE CIPOS E TREPADEIRAS EM RDA OU LD</option><option value='2208'>PA PLANTIO COM FORNECIMENTO DE MUDAS</option><option value='2244'>PA PODA ARVORE RDA OU LD COM RECOLHIMENTO- NOVO</option><option value='2210'>PA PODA CERCA VIVA BAMBU POR METRO LINEAR COM REC</option><option value='2201'>PA PODA DE ARVORE EM RDA OU LD COM RECOLHIMENTO</option><option value='2203'>PA PODA DE BAMBU POR M2  RECOLHIMENTO E DESTINA</option><option value='2202'>PA PODA DE CERCA VIVA POR METRO LINEAR COM RECOLH</option><option value='2207'>PA REBAIXAMENTO DO TOCO COM RECOMPOSICAO DE PISO</option><option value='2209'>PA RECOLHIMENTO DE GALHOS E DESTINACAO FINAL</option><option value='2205'>PA SUPRESSAO DE ARVORE DAP DE ATE 1 M RDA OU LD</option><option value='2206'>PA SUPRESSAO DE ARVORE DAP MAIOR Q 1 M RDA OU LD</option><option value='205'>PARA-RAIOS BT - RETIRAR</option><option value='206'>PARA-RAIOS BT - SUBSTITUIR - EST</option><option value='207'>PARA-RAIOS BT SEM ATERRAMENTO - INSTALAR - EST</option><option value='704076'>PARA-RAIOS INDICADOR DEFEITOS BT MANUT - INSTALAR</option><option value='704077'>PARA-RAIOS INDICADOR DEFEITOS BT MANUT - RETIRAR</option><option value='704074'>PARA-RAIOS INDICADOR DEFEITOS MT MANUT - INSTALAR</option><option value='704075'>PARA-RAIOS INDICADOR DEFEITOS MT MANUT - RETIRAR</option><option value='208'>PARA-RAIOS MT - REMOCAO - REDE CARCACA DO TRAFO</option><option value='209'>PARA-RAIOS MT - RETIRAR - EST</option><option value='210'>PARA-RAIOS MT - SUBSTITUIR - PC</option><option value='211'>PARA-RAIOS MT SEM ATERRAMENTO - INSTALAR - PC</option><option value='500'>PARAMETRIZACAO DE TRIPSAVER</option><option value='704101'>PARAMETRIZACAO TRIP SAVER MANUT - INSTALAR</option><option value='2245'>PARAMETRIZAR RELIG REGUL DE TENSAO CHAVE</option><option value='212'>PASSEIO - MATERIAL E SERVICO - RECOMPOR-UN</option><option value='213'>PINO - SUBSTITUIR-EST</option><option value='214'>PINO RDP - SUBSTITUIR-EST</option><option value='215'>PLACA DE IDENT EQUIP - INSTALAR-SUBSTITUIR - PC</option><option value='704102'>PLACA IDENTIFICACAO EQUIPAMENTO MANUT - INSTALAR</option><option value='704091'>PODAR ARVORE MANUT - PODAR</option><option value='704090'>PONTO P/ ATERRAMENTO TEMPORARIO MANUT - INSTALAR</option><option value='216'>PORCAS - REAPERTAR - RECOLOCAR - EST</option><option value='296'>POSTE - ALCAR</option><option value='221'>POSTE - APRUMAR</option><option value='222'>POSTE - ATE 300 - M. OBRA - CONCRETAR</option><option value='223'>POSTE - ATE 300 - MATERIAL - CONCRETAR</option><option value='225'>POSTE - ESCORAR</option><option value='226'>POSTE - NUMERO -  RDR -(KM) - PINTAR</option><option value='227'>POSTE - REBAIXAR</option><option value='228'>POSTE - RECOLHER</option><option value='229'>POSTE - REMOVER</option><option value='230'>POSTE - SOMENTE MAO-DE-OBRA - CONCRETAR</option><option value='218'>POSTE ACIMA 300 ATE 600 - M. OBRA - CONCRETAR - PC</option><option value='217'>POSTE ACIMA 300 ATE 600 MATERIAL - CONCRETAR - PC</option><option value='219'>POSTE ACIMA DE 600 - M. OBRA - CONCRETAR - PC</option><option value='220'>POSTE ACIMA DE 600 DAN - MATERIAL - CONCRETAR - PC</option><option value='231'>POSTE CC 11,5M E 13,5 -150 (IP) - SUBSTITUIR - PC</option><option value='232'>POSTE CC 11M A 13- 150 (IP) - INSTALAR - PC</option><option value='233'>POSTE COM MT E BT - SUBSTITUIR - PC</option><option value='234'>POSTE COM MT E OU BT - INSTALAR - PC</option><option value='235'>POSTE COM MT E OU BT - RETIRAR - PC</option><option value='236'>POSTE CURVO 10,5 CIRC CON ESCAL. - SUBSTITUIR - PC</option><option value='237'>POSTE DE ACO 16 M (IP) - INSTALAR - PC</option><option value='238'>POSTE DE ACO 16 M (IP) - SUBSTITUIR - PC</option><option value='239'>POSTE DE DESVIO - INSTALAR - PC</option><option value='240'>POSTE DE DESVIO - RETIRAR - PC</option><option value='241'>POSTE RETO 11-15 POL OU CIRC ESC - SUBSTITUIR - PC</option><option value='242'>POSTE RETO 3-6 CIRC CON ESCAL - SUBSTITUIR - PC</option><option value='243'>POSTE RETO 7-10 OCTOG CON CONT - SUBSTITUIR - PC</option><option value='244'>POSTE SOMEN BT MONO OU TRIFASICO - SUBSTITUIR - PC</option><option value='245'>POSTE SOMEN MT MONO OU TRIFASICO - SUBSTITUIR - PC</option><option value='703996'>POSTE/CONTRAPOSTE 9M A 13M MANUT - INSTALAR</option><option value='703997'>POSTE/CONTRAPOSTE 9M A 13M MANUT - RETIRAR</option><option value='703998'>POSTE/CONTRAPOSTE ACIMA DE 13M MANUT - INSTALAR</option><option value='703999'>POSTE/CONTRAPOSTE ACIMA DE 13M MANUT - RETIRAR</option><option value='703994'>POSTE/CONTRAPOSTE ATE 8M MANUT - INSTALAR</option><option value='703995'>POSTE/CONTRAPOSTE ATE 8M MANUT - RETIRAR</option><option value='246'>RAMAL DE LIGACAO AEREO - MUDAR DE FASE - UN</option><option value='247'>RAMAL DE LIGACAO AEREO - SUBSTITUIR</option><option value='248'>RAMAL DE LIGACAO SUBTERRANEO - SUBSTITUIR</option><option value='704133'>RAMAL LIGACAO BT AEREO MANUT - INSTALAR</option><option value='704134'>RAMAL LIGACAO BT AEREO MANUT - RETIRAR</option><option value='704135'>RAMAL LIGACAO BT AEREO MUDA FASE MANUT - INSTALAR</option><option value='704136'>RAMAL LIGACAO BT SUBTERRANEO MANUT - INSTALAR</option><option value='704137'>RAMAL LIGACAO BT SUBTERRANEO MANUT - RETIRAR</option><option value='4151'>RD IND DE SEG VALIDADO-FAIXA</option><option value='3824'>RD IND SEG VALIDADO-OPER-MANUT</option><option value='249'>REATOR EXTERNO INTEGRADO - SUBSTITUIR</option><option value='2240'>RECEBIM INSTAL RETIRADA E DEVOLUCAO GERADOR 500KVA</option><option value='704130'>RECOLHER TERRA COM ÓLEO MANUT - RECOLHER</option><option value='704132'>RECOMPOR PASSEIO MANUT - INSTALAR</option><option value='253'>REGULADOR DE TENSAO (BANCO) - INSPECIONAR</option><option value='250'>REGULADOR DE TENSAO - RETIRAR</option><option value='251'>REGULADOR DE TENSAO - SEM POSTE - INSTALAR</option><option value='252'>REGULADOR DE TENSAO - SUBSTITUIR</option><option value='254'>REGULADOR DE TENSAO MT ENERGIZADA - SUBSTITUIR</option><option value='704051'>REGULADOR TENSAO MT ENERGIZADA MANUT - INSTALAR</option><option value='704052'>REGULADOR TENSAO MT ENERGIZADA MANUT - RETIRAR</option><option value='704053'>REGULADOR TENSAO MT MANUT - INSTALAR</option><option value='704054'>REGULADOR TENSAO MT MANUT - RETIRAR</option><option value='704059'>RELIG/SEC/CHAVE SF6/CJ MED/TR 3F MANUT - INSTALAR</option><option value='704060'>RELIG/SEC/CHAVE SF6/CJ MED/TR 3F MANUT - RETIRAR</option><option value='704061'>RELIG/SEC/SF6/CJ MED/TR MT ENER 3F MAN - INSTALAR</option><option value='704062'>RELIG/SEC/SF6/CJ MED/TR MT ENER 3F MAN - RETIRAR</option><option value='704057'>RELIG/SECC/TR MT ENERGIZADA 1F MANUT - INSTALAR</option><option value='704058'>RELIG/SECC/TR MT ENERGIZADA 1F MANUT - RETIRAR</option><option value='256'>RELIGADOR MONO - COM ACESS SEM POSTE - RETIRAR</option><option value='255'>RELIGADOR MONO - COM ACESS. SEM POSTE -  INSTALAR</option><option value='257'>RELIGADOR MONO - MT ENERGIZADA - SUBSTITUIR</option><option value='258'>RELIGADOR MONO - SEM ACESS - INSTALAR</option><option value='259'>RELIGADOR MONO - SUBSTITUIR</option><option value='261'>RELIGADOR TRIF - COM ACESS ALTER ESTRUT - INSTALAR</option><option value='262'>RELIGADOR TRIF - COM ACESS SEM POSTE - RETIRAR</option><option value='260'>RELIGADOR TRIF. - MT ENERGIZADA - SUBSTITUIR</option><option value='263'>RELIGADOR TRIFASICO - SUBSTITUIR</option><option value='704055'>RELIGADOR/SECC/TRANSFORMADOR 1F MANUT - INSTALAR</option><option value='704056'>RELIGADOR/SECC/TRANSFORMADOR 1F MANUT - RETIRAR</option><option value='291'>REPOSICAO DE MATERIAL</option><option value='290'>REPOSICAO DE MATERIAL DE IP</option><option value='2293'>RETIRADA DE ACCESS POINT AP-CP</option><option value='2291'>RETIRADA DE CONCENTRADOR SECUNDARIO - CS</option><option value='2238'>RETIRAR INSTALAR CABO MT BT MONO PODA OU L FAIXA</option><option value='2239'>RETIRAR INSTALAR CABO MT BT TRIF PODA  L FAIXA</option><option value='264'>SEC MONO - MT ENERGIZADA - SUBSTITUIR</option><option value='265'>SEC TRIF - MT ENERGIZADA - SUBSTITUIR</option><option value='266'>SEC. MONO - COM ACESS E SEM POSTE -  INSTALAR</option><option value='267'>SEC. MONO - COM ACESS E SEM POSTE - RETIRAR</option><option value='268'>SEC. MONO - SEM ACESS - INSTALAR</option><option value='269'>SEC. MONO - SUBSTITUIR</option><option value='270'>SEC. TRIF - COM ACESS ALT. ESTRUT -  INSTALAR</option><option value='271'>SEC. TRIF - COM ACESS E SEM POSTE - RETIRAR</option><option value='272'>SEC. TRIFASICO - SUBSTITUIR</option><option value='273'>SEPARADOR VERTICAL DE MT RDP - SUBSTITUIR</option><option value='704087'>SEPARADOR VERTICAL MT RDP MANUT - INSTALAR</option><option value='704129'>SINALIZAR DISPOSITIVO MANOBRA NA MANUT - INSTALAR</option><option value='298'>SOBREAVISO MANUT PESADA - NSMC - UN - CT21 - 0001</option><option value='274'>TERMINAL MODULAR EXTERNO (TME) - SUBSTITUIR</option><option value='275'>TERMINAL PINO BOLA - INSTALAR</option><option value='276'>TERRA IMPREGNADA OLEO, CARCACA - RECOLHER</option><option value='277'>TRAFO MONO - MT ENERGIZADA - SUBSTITUIR</option><option value='281'>TRAFO MONO - RETIRAR</option><option value='279'>TRAFO MONO COM BLINDAG PADRONIZACAO - INSTALAR</option><option value='280'>TRAFO MONO COM BLINDAG PADRONIZACAO - SUBSTITUIR</option><option value='278'>TRAFO TRIF - MT ENERGIZADA - SUBSTITUIR - UN</option><option value='283'>TRAFO TRIF. COM BLINDAG PADRONIZACAO - INSTALAR</option><option value='284'>TRAFO TRIF. COM BLINDAG PADRONIZACAO - SUBSTITUIR</option><option value='282'>TRAFO TRIF. RETIRAR</option><option value='704138'>VALETA ASFALTO COM DUTOS/CABOS MANUT - INSTALAR</option><option value='286'>VALETA CONCRETO-DUTOS CBS CONEX CONCRETO - FAZER-M</option><option value='285'>VALETA EM ASFAL-DUTOS CBS CONEX ASFAL - FAZER - M</option><option value='287'>VALETA EM TERRA - DUTOS CBS CONEX - FAZER - M</option><option value='288'>VALETA GRAMA - DUTOS CBS CONEX GRAMA - FAZER - M</option><option value='704139'>VALETA GRAMADO COM DUTOS/CABOS MANUT - INSTALAR</option><option value='704140'>VALETA PASSEIO COM DUTOS/CABOS MANUT - INSTALAR</option><option value='704141'>VALETA TERRA COM DUTOS/CABOS MANUT - INSTALAR</option><option value='289'>VESPEIROS - ELIMINAR - EST</option>
                                                    </select>
                                                </td>
                                                <th>Componente:</th>
                                                <td style="width:300px;" colspan="3">
                                                    <select name="componente" id="componente" class="comboEditavelObrig" nome="Componente" style="width:100%">
                                                        <option value=""></option>
                                                    </select>
                                                </td>
                                                <th>Qtde:</th>
                                                <td>
                                                    <input type="text" id="txtQtdeServ" name="txtQtdeServ" size="4" maxlength="3" class="editavelObrig" mask="number" caseType="upper" promptChar=" " insertMode="true">
                                                </td>
                                            </tr>
                                       </table>
                                       <table width="100%" class="TabelaForm" style="border:0px;">
                                            <tr >
											<th style="text-align=left;width:20px;">Equipe:</th>
											<td style="text-align=left;width:150px;">
												<select name="equipe" id="equipe" class="comboEditavelObrig" nome="Equipe" >
													<option value=""></option>
													
														<option value="11">DUPLA</option>
														
														<option value="10">EQUIPE LEVE</option>
														
														<option value="9">EQUIPE PESADA</option>
														
														<option value="8">LV LEVE</option>
														
														<option value="7">LV PESADA</option>
														
											    </select>
											    <script>servicos.arrTipoEquipe.push({value:'11', text:'DUPLA'});arrTipoEquipe.push({value:'11', text:'DUPLA'});servicos.arrTipoEquipe.push({value:'10', text:'EQUIPE LEVE'});arrTipoEquipe.push({value:'10', text:'EQUIPE LEVE'});servicos.arrTipoEquipe.push({value:'9', text:'EQUIPE PESADA'});arrTipoEquipe.push({value:'9', text:'EQUIPE PESADA'});servicos.arrTipoEquipe.push({value:'8', text:'LV LEVE'});arrTipoEquipe.push({value:'8', text:'LV LEVE'});servicos.arrTipoEquipe.push({value:'7', text:'LV PESADA'});arrTipoEquipe.push({value:'7', text:'LV PESADA'});</script>
											</td>
                                            <th>Prioridade:</th>
                                            <td>
                                                <select name="prioridade" id="prioridade" class="comboEditavelObrig" nome="Prioridade">
                                                    <option value=""></option>
                                                    
                                                    <option value="6">1</option>
                                                    
                                                    <option value="2">2</option>
                                                    
                                                    <option value="3">3</option>
                                                    
                                                    <option value="4">4</option>
                                                    
                                                </select>
                                                <script>servicos.arrPrioridade.push({value:'6', text:'1'});arrPrioridade.push({value:'6', text:'1'});servicos.arrPrioridade.push({value:'2', text:'2'});arrPrioridade.push({value:'2', text:'2'});servicos.arrPrioridade.push({value:'3', text:'3'});arrPrioridade.push({value:'3', text:'3'});servicos.arrPrioridade.push({value:'4', text:'4'});arrPrioridade.push({value:'4', text:'4'});</script>
                                            </td>
                                            <td id="tdInvisivel" style="display:block;width:550px;">&nbsp</td>
                                            <th id="thTermograma" style="display:none;">
                                                Termograma:
                                            </th>
                                            <td id="tdTermograma" style="display:none;">
                                                <input type="text" name="tTermografia" id="tTermografia" size="8" maxlength="7" mask="number" maxlength="10" insertMode="true" class="editavelObrig" promptChar=" ">
                                            </td>
                                            <th id="thDeltaT" style="display:none;">
                                                <img src="/contratadaweb/imagens/delta.GIF">T:
                                            </th>
                                            <td style="display:none;" id="tdDeltaT">
                                                <input type="text" name="tDelta" maxlength="5" id="tDelta" size="6" mask="number" maxlength="10" class="editavelObrig" insertMode="true" promptChar=" "><b><font style="color:#505050">&deg;C</font></b> 
                                            </td>
                                            
                                            <th id="thCoordIni" style="display:none;text-align=left;width:80px;">
												Coord.Ini:
											</th>
											<td id="tdCoordIni" style="display:none;width:200px;">
																																																	 
    										    <input type="text" name="insLatiIniSel" id="insLatiIniSel" size="11" nome="Latitude Inicial" mask="custom" maskFormat="-99.999999" maxlength="10" class='editavelObrig' value=""  includePromptCharInValue="true">&nbsp;
                        					    <input type="text" name="insLongIniSel" id="insLongIniSel" size="11" nome="Longitude Inicial" mask="custom" maskFormat="-99.999999" maxlength="10" class='editavelObrig' value=""  includePromptCharInValue="true">
											</td>
											<th id="thCoordFim" style="display:none;text-align=left;width:80px;">
												Coord.Fim:
											</th>
											<td id="tdCoordFim" style="display:none;">
    										    <input type="text" name="insLatiFimSel" id="insLatiFimSel" size="11" nome="Latitude Final" mask="custom" maskFormat="-99.999999" maxlength="10" class='editavelObrig' value=""  includePromptCharInValue="true">&nbsp;
                        					    <input type="text" name="insLongFimSel" id="insLongFimSel" size="11" nome="Longitude Final" mask="custom" maskFormat="-99.999999" maxlength="10" class='editavelObrig' value=""  includePromptCharInValue="true">
											</td>
											
                                            </tr>
                                          </table>
                                          <table width="100%" class="TabelaForm" style="border:0px;">
                                          
                                            <tr >
                                                <th style="text-align=left;width:40px;">Obs:</th>	
                                                <td style="text-align=left;width:500px;">
                                                    <textarea cols="25" name="obsServico"  caseType="upper" maxlength="255" id="obsServico" style="width:100%;" class="editavel"></textarea>
                                                </td>
                                                <td align="left" colspan="6">
                                                    <input type="button" id="btoServicos" name="btoServicos" value="+ Serviços" class="Botao1" style="width:70px;">
                                                    <input type='button' id='btoKitServicos' name='btoKitServicos' value='Kit de Serviços' class='Botao1'   tabIndex='77'>
                                                    <input type="hidden" id="txtPontos" name="txtPontos" size="4" maxlength="3" readonly>
												<input type="hidden" id="txtUS" name="txtUS" size="10" maxlength="9" readonly>
											</td>
										</tr>
										<tr name="tdServicosSel" id="tdServicosSel" style="display:none;">
											<td colspan="15">
												<div style="width:100%;" id="tservicosSel" name="tservicosSel">
													<table id="tabServicos" name="tabServicos" width="100%" class="TabelaListaLocal">
														<tr>
															<th>Id</th>
															<th>Situação</th>
															<th>Tipo Serviço</th>
															<th>Componente</th>
															<th id="pontos_serv_pos_apropriacao">Pontos</th>
															<th id="us_serv_pos_apropriacao">US</th>
															<th>Qtd.</th>
															<th>Prioridade</th>
															<th>Equipe</th>
															<th>Ações</th>
														</tr>
														<tbody id="tservicos">
														</tbody>
													</table>
												</div>
											</td>
										</tr>
									</table>
								</fieldset>
							</td>
						</tr>
					</table>
				</td>
			<!--SERVIÇOS-->
		</tr>
	</table>
	<p align="center">
			
          		<input type="submit" value="Salvar" disabled 
                	id="inserir" name="inserir" class="Botao1" >

                
                
                	
                
                
                <input type="button" name="btoLimpar" value="Novo" class="Botao1" >
                
                	
                
                
                <input type="button" name="btoVoltar" value="Voltar" class="Botao1" onclick="window.close();">
            </p>
            <iframe name="iframeComandos" id="iframeComandos" style="display:none;"></iframe>
            <input type="hidden" name="tag_fonte_alm" id="tag_fonte_alm" value="">
            <input type="hidden" name="matralt" id="matralt" value="e252135">
            <input type="hidden" name="IncluirNota" id="IncluirNota">
            <input type="hidden" name="codDispFonteOri" id="codDispFonteOri">
            <input type="hidden" name="numDispFonteOri" id="numDispFonteOri">
            <input type="hidden" name="localChaveFonteOri" id="localFonteOri">
            <input type="hidden" name="consumoChaveFonteOri" id="consumoFonteOri">
            <input type="hidden" name="codNor" id="codNor">
            <input type="hidden" name="consumoEqu" id="consumoEqu">
            <input type="hidden" name="malhas" id="malhas">
            <input type="hidden" name="todasMalhas" id="todasMalhas">
        </form>
        <div id="ajaxContainer" style="display:none;width:10px;"></div>
        
    </body>
</html>
 
