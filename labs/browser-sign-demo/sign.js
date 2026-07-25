/**
 * Учебный каркас подписи через КриптоПро Browser plug-in.
 * Имена/поведение CADESCOM могут отличаться — сверяйте с примерами вашей версии.
 */
(function () {
  const statusEl = document.getElementById("status");
  const certsEl = document.getElementById("certs");
  const payloadEl = document.getElementById("payload");
  const signatureEl = document.getElementById("signature");
  const btnCerts = document.getElementById("btn-certs");
  const btnSign = document.getElementById("btn-sign");

  /** @type {Map<string, unknown>} */
  const certMap = new Map();

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function canPromise() {
    return window.cadesplugin && window.cadesplugin.CreateObjectAsync;
  }

  async function ensurePlugin() {
    if (!window.cadesplugin) {
      throw new Error("cadesplugin не найден. Установите расширение и native plug-in, обновите страницу.");
    }
    await window.cadesplugin;
  }

  async function loadCertificates() {
    await ensurePlugin();
    certsEl.innerHTML = "";
    certMap.clear();

    if (!canPromise()) {
      throw new Error("Нужен асинхронный API CreateObjectAsync (современный плагин).");
    }

    const store = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
    await store.Open(
      window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
      "My",
      window.cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
    );

    const certificates = await store.Certificates;
    const count = await certificates.Count;
    if (!count) {
      setStatus("Личных сертификатов не найдено.", true);
      return;
    }

    for (let i = 1; i <= count; i += 1) {
      const cert = await certificates.Item(i);
      const subject = await cert.SubjectName;
      const thumbprint = await cert.Thumbprint;
      const option = document.createElement("option");
      option.value = thumbprint;
      option.textContent = `${subject} | ${thumbprint}`;
      certsEl.appendChild(option);
      certMap.set(thumbprint, cert);
    }

    await store.Close();
    setStatus(`Загружено сертификатов: ${count}`);
  }

  async function signDetached() {
    await ensurePlugin();
    const thumbprint = certsEl.value;
    if (!thumbprint || !certMap.has(thumbprint)) {
      throw new Error("Выберите сертификат из списка.");
    }
    const data = payloadEl.value;
    if (!data) {
      throw new Error("Введите текст для подписи.");
    }

    const cert = certMap.get(thumbprint);
    const signer = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
    await signer.propset_Certificate(cert);
    // CADESCOM_CADES_BES = 1 (уточняйте константу в вашей версии)
    await signer.propset_CheckCertificate(true);

    const signedData = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
    await signedData.propset_Content(data);

    const CADES_BES = 1;
    const signature = await signedData.SignCades(signer, CADES_BES, true);
    signatureEl.value = signature;
    setStatus("Подпись создана (detached=true). Проверьте её в КриптоПро / на сервере.");
  }

  async function boot() {
    try {
      await ensurePlugin();
      setStatus("Плагин инициализирован. Можно загружать сертификаты.");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  btnCerts.addEventListener("click", () => {
    loadCertificates().catch((e) => setStatus(String(e.message || e), true));
  });
  btnSign.addEventListener("click", () => {
    signDetached().catch((e) => setStatus(String(e.message || e), true));
  });

  boot();
})();
