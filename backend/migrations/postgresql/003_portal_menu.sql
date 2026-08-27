SET search_path TO ai_lounge, public;

-- Portal의 메뉴 테이블과 같은 핵심 컬럼을 사용한다.
CREATE TABLE IF NOT EXISTS tb_menu (
    menu_id TEXT PRIMARY KEY,
    menu_name TEXT NOT NULL,
    menu_desc TEXT NOT NULL DEFAULT '',
    menu_path TEXT NOT NULL DEFAULT '',
    parent_menu_id TEXT,
    order_num INTEGER NOT NULL DEFAULT 0,
    menu_visible BOOLEAN NOT NULL DEFAULT TRUE,
    menu_depth INTEGER NOT NULL CHECK (menu_depth >= 1),
    CONSTRAINT fk_tb_menu_parent FOREIGN KEY (parent_menu_id)
        REFERENCES tb_menu(menu_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_tb_menu_parent_order ON tb_menu(parent_menu_id, order_num);

CREATE TABLE IF NOT EXISTS tb_menu_role (
    id BIGSERIAL PRIMARY KEY,
    menu_id TEXT NOT NULL,
    menu_role_name TEXT NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_tb_menu_role UNIQUE (menu_id, menu_role_name),
    CONSTRAINT fk_tb_menu_role_menu FOREIGN KEY (menu_id)
        REFERENCES tb_menu(menu_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_tb_menu_role_role_order ON tb_menu_role(menu_role_name, order_num);

INSERT INTO tb_menu
    (menu_id, menu_name, menu_desc, menu_path, parent_menu_id, order_num, menu_visible, menu_depth)
VALUES
    ('U_AI_STUDIO', 'AI STUDIO', '과제를 발굴하고 완성된 AI 자산을 등록·탐색·확산합니다.', '/aistudio/intro', NULL, 100, TRUE, 1),
    ('U_AX_COMMUNITY', 'AX COMMUNITY', 'AI 소식과 업무 활용 경험, 새로운 아이디어를 공유합니다.', '/community/tech-news', NULL, 200, TRUE, 1),
    ('A_AI_MANAGEMENT', 'MANAGEMENT', '아이디어와 AI 자산을 심사하고 Tech News 콘텐츠를 관리합니다.', '/administration/ideas', NULL, 300, TRUE, 1)
ON CONFLICT (menu_id) DO NOTHING;

INSERT INTO tb_menu
    (menu_id, menu_name, menu_desc, menu_path, parent_menu_id, order_num, menu_visible, menu_depth)
VALUES
    ('U_AI_STUDIO_SERVICE', 'AI STUDIO', 'AI STUDIO 서비스', '', 'U_AI_STUDIO', 100, TRUE, 2),
    ('U_AX_COMMUNITY_SERVICE', 'AX COMMUNITY', 'AX COMMUNITY 서비스', '', 'U_AX_COMMUNITY', 200, TRUE, 2),
    ('A_AI_MANAGEMENT_SERVICE', '서비스 관리', 'AI Lounge 운영 관리', '', 'A_AI_MANAGEMENT', 300, TRUE, 2)
ON CONFLICT (menu_id) DO NOTHING;

INSERT INTO tb_menu
    (menu_id, menu_name, menu_desc, menu_path, parent_menu_id, order_num, menu_visible, menu_depth)
VALUES
    ('U_AI_STUDIO_INTRO', '소개', 'AI STUDIO의 역할과 운영 현황', '/aistudio/intro', 'U_AI_STUDIO_SERVICE', 110, TRUE, 3),
    ('U_AI_STUDIO_DX', 'DX 과제 발굴', 'Agent와 대화하며 업무 과제 구체화', '/aistudio/dx-discovery', 'U_AI_STUDIO_SERVICE', 120, TRUE, 3),
    ('U_AI_STUDIO_ASSETS', 'AI 자산 탐색', '검증된 자산 탐색과 현업 확산', '/aistudio/assets/explore', 'U_AI_STUDIO_SERVICE', 130, TRUE, 3),
    ('U_AI_STUDIO_REGISTER', 'AI 자산 등록', '완성 자산 등록과 확산 패키지 생성', '/aistudio/assets/register', 'U_AI_STUDIO_SERVICE', 140, TRUE, 3),
    ('U_AX_COMMUNITY_NEWS', 'AI Tech News', '위아 소식과 외부 AI 동향, BP 사례', '/community/tech-news', 'U_AX_COMMUNITY_SERVICE', 210, TRUE, 3),
    ('U_AX_COMMUNITY_CALENDAR', 'AI Calendar', 'AI 학회·세미나 및 주요 일정을 한눈에 확인', '/community/calendar', 'U_AX_COMMUNITY_SERVICE', 220, TRUE, 3),
    ('U_AX_COMMUNITY_USAGE', '나만의 AI 활용법', '업무에서 직접 시도한 경험과 교훈', '/community/ai-usage', 'U_AX_COMMUNITY_SERVICE', 230, TRUE, 3),
    ('U_AX_COMMUNITY_IDEAS', 'AI 아이디어 공모', '현장의 문제와 AI 적용 아이디어 제안', '/community/ideas', 'U_AX_COMMUNITY_SERVICE', 240, TRUE, 3),
    ('A_AI_MANAGEMENT_IDEAS', 'Idea 심사', '접수된 AI 아이디어 검토와 결과 관리', '/administration/ideas', 'A_AI_MANAGEMENT_SERVICE', 310, TRUE, 3),
    ('A_AI_MANAGEMENT_ASSETS', 'AI 자산 관리', '자산 등록 심사와 운영 상태 관리', '/administration/assets', 'A_AI_MANAGEMENT_SERVICE', 320, TRUE, 3),
    ('A_AI_MANAGEMENT_NEWS', 'Tech News 관리', 'Tech News 작성, 수정과 게시물 관리', '/administration/tech-news', 'A_AI_MANAGEMENT_SERVICE', 330, TRUE, 3)
ON CONFLICT (menu_id) DO NOTHING;

UPDATE tb_menu
SET menu_path = '/aistudio/intro'
WHERE menu_id IN ('U_AI_STUDIO', 'U_AI_STUDIO_INTRO');

UPDATE tb_menu
SET menu_name = 'AI 자산 탐색',
    menu_path = '/aistudio/assets/explore'
WHERE menu_id = 'U_AI_STUDIO_ASSETS';

INSERT INTO tb_menu_role (menu_id, menu_role_name, order_num)
SELECT menu_id, 'AILOUNGE_USER', order_num FROM tb_menu WHERE menu_id LIKE 'U_%'
ON CONFLICT (menu_id, menu_role_name) DO NOTHING;

INSERT INTO tb_menu_role (menu_id, menu_role_name, order_num)
SELECT menu_id, 'AILOUNGE_ADMIN', order_num FROM tb_menu
ON CONFLICT (menu_id, menu_role_name) DO NOTHING;
