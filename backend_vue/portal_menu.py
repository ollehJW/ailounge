from __future__ import annotations

from typing import Any, Callable

from fastapi import Depends, FastAPI


def _build_hierarchy(rows: list[Any]) -> list[dict[str, Any]]:
    menu_by_id: dict[str, dict[str, Any]] = {}
    roots: list[dict[str, Any]] = []

    for row in rows:
        menu_id = str(row["menu_id"])
        menu_by_id[menu_id] = {
            "menu_auth": row["menu_role_name"],
            "menu_id": menu_id,
            "title": row["menu_name"],
            "menu_name": row["menu_name"],
            "menu_desc": row["menu_desc"],
            "parent_menu_id": row["parent_menu_id"],
            "menu_depth": row["menu_depth"],
            "menu_visible": bool(row["menu_visible"]),
            "menu_path": row["menu_path"],
            "authority": "Admin" if menu_id.startswith("A") else "User",
            "order_num": row["order_num"],
            "menu_id_path": row["menu_id_path"],
            "breadcrumb": row["breadcrumb"],
            "child": [],
        }

    for menu in menu_by_id.values():
        parent_id = menu["parent_menu_id"]
        parent = menu_by_id.get(str(parent_id)) if parent_id else None
        if parent is None:
            roots.append(menu)
        else:
            parent["child"].append(menu)

    def sort_children(menu: dict[str, Any]) -> None:
        menu["child"].sort(key=lambda item: (item["order_num"], item["menu_id"]))
        for child in menu["child"]:
            sort_children(child)

    roots.sort(key=lambda item: (item["order_num"], item["menu_id"]))
    for root in roots:
        sort_children(root)
    return roots


def register_portal_menu(
    app: FastAPI,
    get_current_user: Callable[..., Any],
    get_connection: Callable[..., Any],
) -> None:
    @app.get("/api/menu")
    def get_portal_menu(current_user=Depends(get_current_user)) -> dict[str, Any]:
        role_id = "AILOUNGE_ADMIN" if current_user.is_admin else "AILOUNGE_USER"
        with get_connection() as con:
            rows = con.execute(
                """
                WITH RECURSIVE menu_hierarchy AS (
                    SELECT
                        tm.menu_id, tm.menu_name, tm.menu_desc, tm.menu_path,
                        tm.parent_menu_id, tm.menu_depth, tm.order_num,
                        tm.menu_visible, tmr.menu_role_name,
                        tm.menu_id::text AS menu_id_path,
                        tm.menu_name::text AS breadcrumb
                    FROM tb_menu tm
                    JOIN tb_menu_role tmr ON tmr.menu_id = tm.menu_id
                    WHERE tmr.menu_role_name = ?
                      AND (tm.parent_menu_id IS NULL OR tm.parent_menu_id = '')

                    UNION ALL

                    SELECT
                        child.menu_id, child.menu_name, child.menu_desc,
                        child.menu_path, child.parent_menu_id, child.menu_depth,
                        child.order_num, child.menu_visible, child_role.menu_role_name,
                        hierarchy.menu_id_path || '|' || child.menu_id,
                        hierarchy.breadcrumb || '|' || child.menu_name
                    FROM tb_menu child
                    JOIN tb_menu_role child_role ON child_role.menu_id = child.menu_id
                    JOIN menu_hierarchy hierarchy ON hierarchy.menu_id = child.parent_menu_id
                    WHERE child_role.menu_role_name = ?
                )
                SELECT * FROM menu_hierarchy
                ORDER BY order_num, menu_id
                """,
                (role_id, role_id),
            ).fetchall()

        visible_rows = [row for row in rows if bool(row["menu_visible"])]
        return {"data": [{"roleMenuList": _build_hierarchy(visible_rows)}]}
