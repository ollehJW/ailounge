SET search_path TO ai_lounge, public;

CREATE OR REPLACE FUNCTION ai_lounge.increment_diffusion_attempt_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ai_lounge.ai_assets
    SET diffusion_attempt_count = diffusion_attempt_count + 1
    WHERE asset_id = NEW.asset_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ai_lounge.decrement_diffusion_attempt_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ai_lounge.ai_assets
    SET diffusion_attempt_count = GREATEST(diffusion_attempt_count - 1, 0)
    WHERE asset_id = OLD.asset_id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION ai_lounge.increment_diffusion_completed_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ai_lounge.ai_assets
    SET diffusion_completed_count = diffusion_completed_count + 1
    WHERE asset_id = NEW.asset_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ai_lounge.decrement_diffusion_completed_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ai_lounge.ai_assets
    SET diffusion_completed_count = GREATEST(diffusion_completed_count - 1, 0)
    WHERE asset_id = OLD.asset_id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION ai_lounge.increment_qa_helpful_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ai_lounge.ai_asset_qa_posts
    SET helpful_count = helpful_count + 1
    WHERE qa_post_id = NEW.qa_post_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ai_lounge.decrement_qa_helpful_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ai_lounge.ai_asset_qa_posts
    SET helpful_count = GREATEST(helpful_count - 1, 0)
    WHERE qa_post_id = OLD.qa_post_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_asset_diffusion_attempt_insert ON ai_asset_diffusion_attempts;
CREATE TRIGGER trg_ai_asset_diffusion_attempt_insert
AFTER INSERT ON ai_asset_diffusion_attempts
FOR EACH ROW EXECUTE FUNCTION ai_lounge.increment_diffusion_attempt_count();

DROP TRIGGER IF EXISTS trg_ai_asset_diffusion_attempt_delete ON ai_asset_diffusion_attempts;
CREATE TRIGGER trg_ai_asset_diffusion_attempt_delete
AFTER DELETE ON ai_asset_diffusion_attempts
FOR EACH ROW EXECUTE FUNCTION ai_lounge.decrement_diffusion_attempt_count();

DROP TRIGGER IF EXISTS trg_ai_asset_diffusion_case_insert ON ai_asset_diffusion_cases;
CREATE TRIGGER trg_ai_asset_diffusion_case_insert
AFTER INSERT ON ai_asset_diffusion_cases
FOR EACH ROW EXECUTE FUNCTION ai_lounge.increment_diffusion_completed_count();

DROP TRIGGER IF EXISTS trg_ai_asset_diffusion_case_delete ON ai_asset_diffusion_cases;
CREATE TRIGGER trg_ai_asset_diffusion_case_delete
AFTER DELETE ON ai_asset_diffusion_cases
FOR EACH ROW EXECUTE FUNCTION ai_lounge.decrement_diffusion_completed_count();

DROP TRIGGER IF EXISTS trg_ai_asset_qa_helpful_insert ON ai_asset_qa_helpful;
CREATE TRIGGER trg_ai_asset_qa_helpful_insert
AFTER INSERT ON ai_asset_qa_helpful
FOR EACH ROW EXECUTE FUNCTION ai_lounge.increment_qa_helpful_count();

DROP TRIGGER IF EXISTS trg_ai_asset_qa_helpful_delete ON ai_asset_qa_helpful;
CREATE TRIGGER trg_ai_asset_qa_helpful_delete
AFTER DELETE ON ai_asset_qa_helpful
FOR EACH ROW EXECUTE FUNCTION ai_lounge.decrement_qa_helpful_count();
