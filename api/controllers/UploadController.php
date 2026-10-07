<?php
/**
 * Upload Controller (UploadController.php)
 * Gerenciador seguro de upload de imagens de produtos e recursos
 * Salva fisicamente em /api/upload e retorna o caminho relativo para a BD
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';

class UploadController {

    private string $uploadDir;
    private array $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    private array $allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml'
    ];
    private int $maxSize = 5242880; // 5MB

    public function __construct() {
        $this->uploadDir = realpath(__DIR__ . '/../upload') ?: (__DIR__ . '/../upload');
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0755, true);
        }
    }

    /**
     * Upload de imagem de produto
     * POST /upload
     */
    public function uploadImage(Request $request): void {
        $file = $request->file('image') ?? $request->file('file');

        if (!$file) {
            Response::error('Nenhum arquivo enviado. Selecione uma imagem.', 400);
            return;
        }

        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errorMsg = match ($file['error']) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'O arquivo ultrapassa o tamanho máximo permitido (5MB).',
                UPLOAD_ERR_PARTIAL => 'O upload do arquivo foi interrompido.',
                UPLOAD_ERR_NO_FILE => 'Nenhum arquivo foi selecionado.',
                default => 'Falha no upload do arquivo.'
            };
            Response::error($errorMsg, 400);
            return;
        }

        if ($file['size'] > $this->maxSize) {
            Response::error('A imagem excede o tamanho limite de 5MB.', 413);
            return;
        }

        $origName = $file['name'];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

        if (!in_array($ext, $this->allowedExtensions, true)) {
            Response::error('Formato de arquivo inválido. Permitidos: JPG, PNG, WEBP, GIF, SVG.', 415);
            return;
        }

        // Validação de tipo MIME real
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if ($ext !== 'svg' && !in_array($mime, $this->allowedMimes, true)) {
            Response::error('O arquivo enviado não é uma imagem válida.', 415);
            return;
        }

        // Gerar nome único e seguro
        $uniqueName = 'prod_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $destPath = $this->uploadDir . DIRECTORY_SEPARATOR . $uniqueName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Response::error('Erro ao salvar imagem no servidor.', 500);
            return;
        }

        $relativePath = 'upload/' . $uniqueName;
        $publicUrl = '/liq/api/upload/' . $uniqueName;

        Response::success([
            'filename' => $uniqueName,
            'path' => $relativePath,
            'url' => $publicUrl
        ], 'Imagem carregada com sucesso!', 201);
    }
}
